"""
ChainSwap Backend Regression Tests
Covers: Auth (register, login, admin), Offers, Trades, Messages, Admin, Stats
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://chainswap-exchange.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@chainswap.com"
ADMIN_PASSWORD = "Admin@123"

# unique suffix per run
SUFFIX = uuid.uuid4().hex[:6]
U1_USERNAME = f"testuser1_{SUFFIX}"
U1_EMAIL = f"testuser1_{SUFFIX}@test.com"
U2_USERNAME = f"testuser2_{SUFFIX}"
U2_EMAIL = f"testuser2_{SUFFIX}@test.com"
PWD = "Test@123"


@pytest.fixture(scope="function")
def session():
    """Fresh session per test to avoid cookie pollution (backend prefers cookie over Authorization)."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _fresh_login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    return r


@pytest.fixture(scope="session")
def admin_token():
    r = _fresh_login(ADMIN_EMAIL, ADMIN_PASSWORD)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("role") == "admin"
    return data["token"]


@pytest.fixture(scope="session")
def user1():
    r = requests.post(f"{API}/auth/register", json={
        "username": U1_USERNAME, "email": U1_EMAIL, "password": PWD
    })
    if r.status_code == 400:
        r = _fresh_login(U1_EMAIL, PWD)
    assert r.status_code == 200, f"U1 register/login failed: {r.status_code} {r.text}"
    data = r.json()
    return {"token": data["token"], "id": data["id"], "username": data["username"]}


@pytest.fixture(scope="session")
def user2():
    r = requests.post(f"{API}/auth/register", json={
        "username": U2_USERNAME, "email": U2_EMAIL, "password": PWD
    })
    if r.status_code == 400:
        r = _fresh_login(U2_EMAIL, PWD)
    assert r.status_code == 200, f"U2 register/login failed: {r.status_code} {r.text}"
    data = r.json()
    return {"token": data["token"], "id": data["id"], "username": data["username"]}


def auth_h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ============ Health & Stats ============

def test_stats_public(session):
    r = session.get(f"{API}/stats")
    assert r.status_code == 200
    data = r.json()
    for k in ["total_offers", "total_trades", "completed_trades", "total_volume_inr"]:
        assert k in data


# ============ Auth ============

def test_admin_login(admin_token):
    assert isinstance(admin_token, str) and len(admin_token) > 0


def test_invalid_login(session):
    r = session.post(f"{API}/auth/login", json={"email": "nope@x.com", "password": "wrong"})
    assert r.status_code == 401


def test_register_short_password(session):
    r = session.post(f"{API}/auth/register", json={
        "username": f"short_{SUFFIX}", "email": f"short_{SUFFIX}@x.com", "password": "123"
    })
    assert r.status_code == 400


def test_user1_register(user1):
    assert user1["token"]
    assert user1["username"] == U1_USERNAME


def test_auth_me(session, user1):
    r = session.get(f"{API}/auth/me", headers=auth_h(user1["token"]))
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == U1_EMAIL
    assert data["role"] == "user"
    assert "password_hash" not in data
    assert "_id" not in data


def test_auth_me_no_token(session):
    r = session.get(f"{API}/auth/me")
    assert r.status_code == 401


# ============ Offers ============

@pytest.fixture(scope="session")
def offer_id(user1):
    payload = {
        "type": "sell",
        "network": "TRC20",
        "price_inr": 88.5,
        "min_limit_inr": 500,
        "max_limit_inr": 50000,
        "payment_methods": ["UPI"],
        "payment_window_mins": 30,
        "trade_terms": "Test terms",
        "available_usdt": 1000,
    }
    r = requests.post(f"{API}/offers", json=payload, headers=auth_h(user1["token"]))
    assert r.status_code == 200, f"Create offer failed: {r.status_code} {r.text}"
    return r.json()["id"]


def test_create_offer(offer_id):
    assert offer_id


def test_list_offers_sell(session, offer_id):
    r = session.get(f"{API}/offers?type=sell")
    assert r.status_code == 200
    offers = r.json()
    assert isinstance(offers, list)
    # Our created offer should be in list
    ids = [o.get("id") for o in offers]
    assert offer_id in ids
    # validate shape
    for o in offers:
        if o["id"] == offer_id:
            assert o["price_inr"] == 88.5
            assert o["network"] == "TRC20"
            assert o["available_usdt"] == 1000
            assert "UPI" in o["payment_methods"]
            assert "user_stats" in o


def test_get_offer(session, offer_id):
    r = session.get(f"{API}/offers/{offer_id}")
    assert r.status_code == 200
    o = r.json()
    assert o["id"] == offer_id
    assert o["price_inr"] == 88.5


def test_my_offers(session, user1, offer_id):
    r = session.get(f"{API}/my-offers", headers=auth_h(user1["token"]))
    assert r.status_code == 200
    assert any(o["id"] == offer_id for o in r.json())


# ============ Trades ============

@pytest.fixture(scope="session")
def trade_id(user2, offer_id):
    r = requests.post(f"{API}/trades", json={
        "offer_id": offer_id, "amount_usdt": 10, "payment_method": "UPI"
    }, headers=auth_h(user2["token"]))
    assert r.status_code == 200, f"Initiate trade failed: {r.status_code} {r.text}"
    return r.json()["id"]


def test_initiate_trade(trade_id):
    assert trade_id


def test_cannot_trade_with_self(session, user1, offer_id):
    r = session.post(f"{API}/trades", json={
        "offer_id": offer_id, "amount_usdt": 10, "payment_method": "UPI"
    }, headers=auth_h(user1["token"]))
    assert r.status_code == 400


def test_get_trade(session, user2, trade_id):
    r = session.get(f"{API}/trades/{trade_id}", headers=auth_h(user2["token"]))
    assert r.status_code == 200
    t = r.json()
    assert t["id"] == trade_id
    assert t["amount_usdt"] == 10
    assert t["status"] == "INITIATED"
    assert t["is_buyer"] is True  # u2 initiated from sell offer
    assert "buyer_info" in t and "seller_info" in t


def test_list_trades(session, user2, trade_id):
    r = session.get(f"{API}/trades", headers=auth_h(user2["token"]))
    assert r.status_code == 200
    ids = [t["id"] for t in r.json()]
    assert trade_id in ids


def test_trade_access_denied_other_user(session, admin_token, trade_id):
    # Non-admin non-participant should 403; admin should pass. We test unauthenticated -> 401
    r = requests.get(f"{API}/trades/{trade_id}")
    assert r.status_code == 401


def test_trade_messages_initial(session, user2, trade_id):
    r = session.get(f"{API}/trades/{trade_id}/messages", headers=auth_h(user2["token"]))
    assert r.status_code == 200
    msgs = r.json()
    assert len(msgs) >= 1
    assert msgs[0]["message_type"] == "system"


def test_send_message(session, user2, trade_id):
    r = session.post(f"{API}/trades/{trade_id}/messages",
                     json={"message": "Hello from buyer", "message_type": "text"},
                     headers=auth_h(user2["token"]))
    assert r.status_code == 200
    # Verify via GET
    r2 = session.get(f"{API}/trades/{trade_id}/messages", headers=auth_h(user2["token"]))
    assert any(m.get("message") == "Hello from buyer" for m in r2.json())


def test_update_trade_status_payment_sent(session, user2, trade_id):
    r = session.patch(f"{API}/trades/{trade_id}/status",
                      json={"status": "PAYMENT_SENT"},
                      headers=auth_h(user2["token"]))
    assert r.status_code == 200
    # Verify
    r2 = session.get(f"{API}/trades/{trade_id}", headers=auth_h(user2["token"]))
    assert r2.json()["status"] == "PAYMENT_SENT"


# ============ Admin ============

def test_admin_stats(session, admin_token):
    r = session.get(f"{API}/admin/stats", headers=auth_h(admin_token))
    assert r.status_code == 200
    data = r.json()
    for k in ["total_users", "active_users_24h", "open_disputes", "total_offers"]:
        assert k in data


def test_admin_stats_forbidden_for_user(session, user1):
    r = session.get(f"{API}/admin/stats", headers=auth_h(user1["token"]))
    assert r.status_code == 403


def test_admin_list_users(session, admin_token):
    r = session.get(f"{API}/admin/users", headers=auth_h(admin_token))
    assert r.status_code == 200
    users = r.json()
    assert isinstance(users, list)
    assert all("password_hash" not in u for u in users)


def test_admin_list_trades(session, admin_token, trade_id):
    r = session.get(f"{API}/admin/trades", headers=auth_h(admin_token))
    assert r.status_code == 200
    ids = [t["id"] for t in r.json()]
    assert trade_id in ids


def test_admin_list_offers(session, admin_token, offer_id):
    r = session.get(f"{API}/admin/offers", headers=auth_h(admin_token))
    assert r.status_code == 200
    assert any(o["id"] == offer_id for o in r.json())


# ============ Notifications ============

def test_notifications(session, user1):
    # user1 is the offer owner; should have received notification on trade initiation
    r = session.get(f"{API}/notifications", headers=auth_h(user1["token"]))
    assert r.status_code == 200
    notifs = r.json()
    assert isinstance(notifs, list)


def test_unread_count(session, user1):
    r = session.get(f"{API}/notifications/unread-count", headers=auth_h(user1["token"]))
    assert r.status_code == 200
    assert "count" in r.json()
