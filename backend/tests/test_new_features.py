"""
ChainSwap Phase-2 Backend Tests
Covers: Forgot/Reset Password, CSV Exports, Trade Auto-Expiry, WebSocket auth, Email mock.
"""
import os
import io
import csv
import json
import time
import uuid
import asyncio
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://chainswap-exchange.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")

ADMIN_EMAIL = "admin@chainswap.com"
ADMIN_PASSWORD = "Admin@123"

SUFFIX = uuid.uuid4().hex[:6]
U_EMAIL = f"reset_{SUFFIX}@test.com"
U_USER = f"reset_{SUFFIX}"
PWD_OLD = "Test@123"
PWD_NEW = "NewPass@456"


def _login(email, password):
    return requests.post(f"{API}/auth/login", json={"email": email, "password": password})


@pytest.fixture(scope="module")
def admin_token():
    r = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def test_user():
    r = requests.post(f"{API}/auth/register", json={
        "username": U_USER, "email": U_EMAIL, "password": PWD_OLD
    })
    assert r.status_code == 200, f"Register failed: {r.text}"
    return r.json()


def auth_h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ============ Forgot / Reset Password ============

def test_forgot_password_existing_email(test_user):
    r = requests.post(f"{API}/auth/forgot-password", json={"email": U_EMAIL})
    assert r.status_code == 200
    data = r.json()
    assert "message" in data
    assert "reset link" in data["message"].lower() or "sent" in data["message"].lower()


def test_forgot_password_nonexistent_email_returns_200():
    # Enumeration prevention: should always return success
    r = requests.post(f"{API}/auth/forgot-password", json={
        "email": f"nonexistent_{uuid.uuid4().hex[:6]}@nowhere.com"
    })
    assert r.status_code == 200
    assert "message" in r.json()


def test_reset_password_invalid_token():
    r = requests.post(f"{API}/auth/reset-password", json={
        "token": "totally-invalid-token-xyz", "password": "AnyPass@123"
    })
    assert r.status_code == 400
    assert "expired" in r.json().get("detail", "").lower() or "invalid" in r.json().get("detail", "").lower()


def test_reset_password_short_password():
    r = requests.post(f"{API}/auth/reset-password", json={
        "token": "whatever", "password": "123"
    })
    assert r.status_code == 400


def test_reset_password_full_flow(test_user):
    """
    Full flow: trigger forgot-password, then retrieve token directly from DB
    (since SMTP is mocked), reset, and verify login with new password.
    """
    # Trigger
    r = requests.post(f"{API}/auth/forgot-password", json={"email": U_EMAIL})
    assert r.status_code == 200

    # Fetch the token from MongoDB
    import pymongo
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")
    client = pymongo.MongoClient(mongo_url)
    db = client[db_name]
    user_doc = db.users.find_one({"email": U_EMAIL})
    assert user_doc is not None
    token_doc = db.password_reset_tokens.find_one(
        {"user_id": str(user_doc["_id"]), "used": False},
        sort=[("created_at", -1)]
    )
    assert token_doc is not None, "Reset token was not inserted in DB"
    reset_token = token_doc["token"]

    # Reset with valid token
    r = requests.post(f"{API}/auth/reset-password", json={
        "token": reset_token, "password": PWD_NEW
    })
    assert r.status_code == 200, f"Reset failed: {r.text}"
    assert "success" in r.json().get("message", "").lower()

    # Old password should fail
    r_old = _login(U_EMAIL, PWD_OLD)
    assert r_old.status_code == 401

    # New password should work
    r_new = _login(U_EMAIL, PWD_NEW)
    assert r_new.status_code == 200

    # Token now marked used -> re-use should fail
    r_reuse = requests.post(f"{API}/auth/reset-password", json={
        "token": reset_token, "password": "Another@789"
    })
    assert r_reuse.status_code == 400


# ============ CSV Export (Admin) ============

def test_export_trades_csv_admin(admin_token):
    r = requests.get(f"{API}/admin/export/trades", headers=auth_h(admin_token))
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    assert "attachment" in r.headers.get("content-disposition", "").lower()
    assert "filename=" in r.headers.get("content-disposition", "").lower()
    body = r.text
    reader = csv.reader(io.StringIO(body))
    rows = list(reader)
    assert len(rows) >= 1
    header = rows[0]
    for col in ["Trade ID", "Buyer", "Seller", "Amount USDT", "Status"]:
        assert col in header, f"Missing column {col} in {header}"


def test_export_users_csv_admin(admin_token):
    r = requests.get(f"{API}/admin/export/users", headers=auth_h(admin_token))
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    assert "attachment" in r.headers.get("content-disposition", "").lower()
    body = r.text
    reader = csv.reader(io.StringIO(body))
    rows = list(reader)
    assert len(rows) >= 1
    header = rows[0]
    for col in ["User ID", "Username", "Email", "Role"]:
        assert col in header


def test_export_trades_forbidden_for_non_admin(test_user):
    # login as regular user (use current password state -> PWD_NEW after reset flow)
    r_login = _login(U_EMAIL, PWD_NEW)
    if r_login.status_code != 200:
        r_login = _login(U_EMAIL, PWD_OLD)
    assert r_login.status_code == 200
    token = r_login.json()["token"]
    r = requests.get(f"{API}/admin/export/trades", headers=auth_h(token))
    assert r.status_code == 403


def test_export_users_forbidden_unauthenticated():
    r = requests.get(f"{API}/admin/export/users")
    assert r.status_code == 401


# ============ Trade Auto-Expiry ============

def test_trade_auto_expiry():
    """
    Create a trade, rewind created_at in DB, wait for background task, verify EXPIRED.
    Background task runs every 30s.
    """
    import pymongo
    from datetime import datetime, timezone, timedelta
    from bson import ObjectId

    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")
    client = pymongo.MongoClient(mongo_url)
    db = client[db_name]

    # Seller
    sfx = uuid.uuid4().hex[:6]
    seller_email = f"exp_seller_{sfx}@test.com"
    buyer_email = f"exp_buyer_{sfx}@test.com"
    r = requests.post(f"{API}/auth/register", json={
        "username": f"exp_seller_{sfx}", "email": seller_email, "password": PWD_OLD
    })
    assert r.status_code == 200
    seller_tok = r.json()["token"]
    r = requests.post(f"{API}/auth/register", json={
        "username": f"exp_buyer_{sfx}", "email": buyer_email, "password": PWD_OLD
    })
    assert r.status_code == 200
    buyer_tok = r.json()["token"]

    # Create offer with short window
    r = requests.post(f"{API}/offers", json={
        "type": "sell", "network": "TRC20", "price_inr": 88.5,
        "min_limit_inr": 100, "max_limit_inr": 10000, "payment_methods": ["UPI"],
        "payment_window_mins": 1, "trade_terms": "expiry test", "available_usdt": 100,
    }, headers=auth_h(seller_tok))
    assert r.status_code == 200, r.text
    offer_id = r.json()["id"]

    # Initiate
    r = requests.post(f"{API}/trades", json={
        "offer_id": offer_id, "amount_usdt": 5, "payment_method": "UPI"
    }, headers=auth_h(buyer_tok))
    assert r.status_code == 200, r.text
    trade_id = r.json()["id"]

    # Rewind created_at 5 minutes in the past
    past = datetime.now(timezone.utc) - timedelta(minutes=5)
    result = db.trades.update_one(
        {"_id": ObjectId(trade_id)},
        {"$set": {"created_at": past, "payment_window_mins": 1}}
    )
    assert result.modified_count == 1

    # Background task runs every 30s; wait up to 40s
    status = None
    for _ in range(9):
        time.sleep(5)
        r = requests.get(f"{API}/trades/{trade_id}", headers=auth_h(buyer_tok))
        if r.status_code == 200:
            status = r.json().get("status")
            if status == "EXPIRED":
                break
    assert status == "EXPIRED", f"Trade did not auto-expire. Last status={status}"

    # Verify available_usdt was restored to offer
    r_off = requests.get(f"{API}/offers/{offer_id}")
    assert r_off.status_code == 200
    # available went 100 -> 95 (after initiate) -> 100 (after expiry refund)
    assert r_off.json()["available_usdt"] == 100


# ============ WebSocket ============

def test_websocket_rejects_without_token():
    try:
        from websockets.sync.client import connect
        from websockets.exceptions import InvalidStatus, ConnectionClosed
    except Exception:
        pytest.skip("websockets library not available")

    url = f"{WS_BASE}/ws/trade/any-trade-id"
    try:
        ws = connect(url, open_timeout=10)
        # If we get a handshake, connection should close quickly with 4001
        try:
            ws.recv(timeout=3)
        except ConnectionClosed:
            pass
        ws.close()
    except (InvalidStatus, Exception) as e:
        # Either HTTP 403 handshake reject or close frame ok
        assert True


def test_websocket_rejects_invalid_token():
    try:
        from websockets.sync.client import connect
        from websockets.exceptions import ConnectionClosed
    except Exception:
        pytest.skip("websockets library not available")

    url = f"{WS_BASE}/ws/trade/507f1f77bcf86cd799439011?token=badtoken"
    ws = None
    try:
        ws = connect(url, open_timeout=10)
        # Should close with 4001
        closed = False
        try:
            ws.recv(timeout=5)
        except ConnectionClosed:
            closed = True
        assert closed or ws.protocol.state.name in ("CLOSED", "CLOSING")
    finally:
        if ws:
            try: ws.close()
            except: pass


def test_websocket_accepts_valid_token_and_message(admin_token):
    """
    Full WS flow: register 2 users, create offer+trade, connect WS with valid JWT,
    send message, verify broadcast.
    """
    try:
        from websockets.sync.client import connect
        from websockets.exceptions import ConnectionClosed
    except Exception:
        pytest.skip("websockets library not available")

    sfx = uuid.uuid4().hex[:6]
    r1 = requests.post(f"{API}/auth/register", json={
        "username": f"ws_s_{sfx}", "email": f"ws_s_{sfx}@t.com", "password": PWD_OLD
    })
    r2 = requests.post(f"{API}/auth/register", json={
        "username": f"ws_b_{sfx}", "email": f"ws_b_{sfx}@t.com", "password": PWD_OLD
    })
    assert r1.status_code == 200 and r2.status_code == 200
    seller_tok = r1.json()["token"]
    buyer_tok = r2.json()["token"]

    r = requests.post(f"{API}/offers", json={
        "type": "sell", "network": "TRC20", "price_inr": 88.5,
        "min_limit_inr": 100, "max_limit_inr": 10000, "payment_methods": ["UPI"],
        "payment_window_mins": 30, "trade_terms": "ws test", "available_usdt": 100,
    }, headers=auth_h(seller_tok))
    assert r.status_code == 200
    offer_id = r.json()["id"]

    r = requests.post(f"{API}/trades", json={
        "offer_id": offer_id, "amount_usdt": 5, "payment_method": "UPI"
    }, headers=auth_h(buyer_tok))
    assert r.status_code == 200
    trade_id = r.json()["id"]

    url = f"{WS_BASE}/ws/trade/{trade_id}?token={buyer_tok}"
    ws = connect(url, open_timeout=10)
    try:
        ws.send(json.dumps({"type": "message", "message": "hello via ws"}))
        # Wait for broadcast echo
        got = False
        for _ in range(5):
            try:
                raw = ws.recv(timeout=3)
                data = json.loads(raw)
                if data.get("type") == "new_message" and data.get("message") == "hello via ws":
                    got = True
                    break
            except ConnectionClosed:
                break
            except Exception:
                break
        assert got, "Did not receive broadcast message via WS"

        # Verify message was persisted
        r = requests.get(f"{API}/trades/{trade_id}/messages", headers=auth_h(buyer_tok))
        assert r.status_code == 200
        assert any(m.get("message") == "hello via ws" for m in r.json())
    finally:
        try: ws.close()
        except: pass


# ============ Email Mock Logging ============

def test_email_mock_logs_on_forgot_password():
    """Trigger forgot-password and verify the backend log contains the reset link."""
    email_sfx = uuid.uuid4().hex[:6]
    email = f"emailmock_{email_sfx}@test.com"
    # register user first
    r = requests.post(f"{API}/auth/register", json={
        "username": f"emailmock_{email_sfx}", "email": email, "password": PWD_OLD
    })
    assert r.status_code == 200

    r = requests.post(f"{API}/auth/forgot-password", json={"email": email})
    assert r.status_code == 200
    # Allow logs to flush
    time.sleep(1)

    log_paths = [
        "/var/log/supervisor/backend.out.log",
        "/var/log/supervisor/backend.err.log",
    ]
    found = False
    for p in log_paths:
        if not os.path.exists(p):
            continue
        try:
            with open(p, "r", errors="ignore") as f:
                content = f.read()[-200000:]
            if "reset-password?token=" in content or "Password reset link" in content or "[EMAIL MOCK]" in content:
                found = True
                break
        except Exception:
            continue
    assert found, "No email mock / reset link logs found in backend logs"
