from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import bcrypt
import jwt
import json
import csv
import io
import secrets
import asyncio
import aiofiles
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Set
from bson import ObjectId

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"

# Create app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Upload directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# ============ WEBSOCKET MANAGER ============

class ConnectionManager:
    """Manages WebSocket connections per trade_id"""
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, trade_id: str):
        await websocket.accept()
        if trade_id not in self.active_connections:
            self.active_connections[trade_id] = []
        self.active_connections[trade_id].append(websocket)

    def disconnect(self, websocket: WebSocket, trade_id: str):
        if trade_id in self.active_connections:
            self.active_connections[trade_id] = [
                conn for conn in self.active_connections[trade_id] if conn != websocket
            ]
            if not self.active_connections[trade_id]:
                del self.active_connections[trade_id]

    async def broadcast_to_trade(self, trade_id: str, message: dict):
        if trade_id in self.active_connections:
            dead = []
            for connection in self.active_connections[trade_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    dead.append(connection)
            for d in dead:
                self.disconnect(d, trade_id)

ws_manager = ConnectionManager()

# ============ EMAIL SERVICE ============

async def send_email(to_email: str, subject: str, body: str):
    """Send email notification. Uses SMTP if configured, otherwise logs to console."""
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASS")
    from_email = os.environ.get("SMTP_FROM", "noreply@chainswap.com")

    if smtp_host and smtp_user and smtp_pass:
        try:
            import aiosmtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart

            msg = MIMEMultipart()
            msg["From"] = from_email
            msg["To"] = to_email
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "html"))

            await aiosmtplib.send(
                msg,
                hostname=smtp_host,
                port=smtp_port,
                username=smtp_user,
                password=smtp_pass,
                use_tls=True,
            )
            logger.info(f"Email sent to {to_email}: {subject}")
        except Exception as e:
            logger.error(f"Email send failed to {to_email}: {e}")
    else:
        logger.info(f"[EMAIL MOCK] To: {to_email} | Subject: {subject} | Body: {body[:100]}...")

async def send_trade_email(user_id: str, event: str, trade_data: dict):
    """Send trade-related email notification"""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return
    
    templates = {
        "trade_initiated": {
            "subject": "New Trade Initiated - ChainSwap",
            "body": f"<h2>New Trade Initiated</h2><p>A trade of {trade_data.get('amount_usdt', 0)} USDT (₹{trade_data.get('amount_inr', 0):.2f}) has been initiated.</p><p>Trade ID: {trade_data.get('id', 'N/A')}</p><p>Please check your ChainSwap dashboard.</p>"
        },
        "payment_sent": {
            "subject": "Payment Marked as Sent - ChainSwap",
            "body": f"<h2>Payment Sent</h2><p>The buyer has marked the payment as sent for trade {trade_data.get('id', 'N/A')[:8]}.</p><p>Amount: ₹{trade_data.get('amount_inr', 0):.2f}</p><p>Please verify and confirm.</p>"
        },
        "trade_completed": {
            "subject": "Trade Completed - ChainSwap",
            "body": f"<h2>Trade Completed!</h2><p>Trade {trade_data.get('id', 'N/A')[:8]} has been completed successfully.</p><p>Amount: {trade_data.get('amount_usdt', 0)} USDT</p>"
        },
        "dispute_raised": {
            "subject": "Dispute Raised - ChainSwap",
            "body": f"<h2>Dispute Raised</h2><p>A dispute has been raised on trade {trade_data.get('id', 'N/A')[:8]}.</p><p>Reason: {trade_data.get('dispute_reason', 'N/A')}</p><p>Our admin team will review and resolve.</p>"
        },
        "dispute_resolved": {
            "subject": "Dispute Resolved - ChainSwap",
            "body": f"<h2>Dispute Resolved</h2><p>The dispute on trade {trade_data.get('id', 'N/A')[:8]} has been resolved by admin.</p><p>Note: {trade_data.get('admin_note', 'N/A')}</p>"
        },
        "trade_expired": {
            "subject": "Trade Expired - ChainSwap",
            "body": f"<h2>Trade Expired</h2><p>Trade {trade_data.get('id', 'N/A')[:8]} has expired due to payment window timeout.</p><p>The USDT has been returned to the offer.</p>"
        },
    }
    
    template = templates.get(event)
    if template:
        await send_email(user["email"], template["subject"], template["body"])

# ============ HELPERS ============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(hours=24), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if user.get("is_banned"):
            raise HTTPException(status_code=403, detail="Account suspended")
        user["id"] = str(user["_id"])
        del user["_id"]
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

def serialize_user(user: dict) -> dict:
    result = {k: v for k, v in user.items() if k != "_id" and k != "password_hash"}
    if "_id" in user:
        result["id"] = str(user["_id"])
    if "created_at" in result and isinstance(result["created_at"], datetime):
        result["created_at"] = result["created_at"].isoformat()
    if "last_seen" in result and isinstance(result["last_seen"], datetime):
        result["last_seen"] = result["last_seen"].isoformat()
    # Verified Trader badge: 50+ completed trades
    result["is_verified_trader"] = result.get("completed_trades", 0) >= 50
    return result

# ============ AUTH ROUTES ============

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    wallet_address: Optional[str] = ""

class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    password: str

@api_router.post("/auth/register")
async def register(req: RegisterRequest, response: Response):
    email = req.email.lower().strip()
    username = req.username.strip()
    
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    
    existing_email = await db.users.find_one({"email": email})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    existing_username = await db.users.find_one({"username": username})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # First user gets admin role
    user_count = await db.users.count_documents({})
    role = "admin" if user_count == 0 else "user"
    
    user_doc = {
        "username": username,
        "email": email,
        "password_hash": hash_password(req.password),
        "wallet_address": req.wallet_address or "",
        "role": role,
        "is_verified": True,
        "is_banned": False,
        "total_trades": 0,
        "completed_trades": 0,
        "completion_rate": 0.0,
        "avg_response_time": 0,
        "strikes": 0,
        "created_at": datetime.now(timezone.utc),
        "last_seen": datetime.now(timezone.utc),
    }
    
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return {"id": user_id, "username": username, "email": email, "role": role, "token": access_token}

@api_router.post("/auth/login")
async def login(req: LoginRequest, request: Request, response: Response):
    email = req.email.lower().strip()
    
    # Brute force check
    ip = request.client.host
    identifier = f"{ip}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= 5:
        lockout_time = attempt.get("last_attempt", datetime.now(timezone.utc)) + timedelta(minutes=15)
        if datetime.now(timezone.utc) < lockout_time:
            raise HTTPException(status_code=429, detail="Too many login attempts. Try again in 15 minutes.")
        else:
            await db.login_attempts.delete_one({"identifier": identifier})
    
    # Find user by email or username
    user = await db.users.find_one({"$or": [{"email": email}, {"username": email}]})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if user.get("is_banned"):
        raise HTTPException(status_code=403, detail="Account suspended. Contact support.")
    
    if not verify_password(req.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"last_attempt": datetime.now(timezone.utc)}},
            upsert=True
        )
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Clear failed attempts
    await db.login_attempts.delete_one({"identifier": identifier})
    
    # Update last seen
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"last_seen": datetime.now(timezone.utc)}})
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, user["email"])
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return {"id": user_id, "username": user["username"], "email": user["email"], "role": user["role"], "token": access_token}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access_token = create_access_token(str(user["_id"]), user["email"])
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
        return {"message": "Token refreshed"}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# ============ FORGOT PASSWORD ============

@api_router.post("/auth/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    email = req.email.lower().strip()
    user = await db.users.find_one({"email": email})
    # Always return success to prevent email enumeration
    if not user:
        return {"message": "If an account with that email exists, a reset link has been sent."}
    
    # Generate reset token
    reset_token = secrets.token_urlsafe(32)
    await db.password_reset_tokens.insert_one({
        "user_id": str(user["_id"]),
        "token": reset_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
        "used": False,
        "created_at": datetime.now(timezone.utc),
    })
    
    # Send email with reset link
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"
    await send_email(
        email,
        "Password Reset - ChainSwap",
        f"<h2>Password Reset</h2><p>Click the link below to reset your password:</p><p><a href='{reset_link}'>{reset_link}</a></p><p>This link expires in 1 hour.</p><p>If you didn't request this, ignore this email.</p>"
    )
    
    logger.info(f"Password reset link: {reset_link}")
    return {"message": "If an account with that email exists, a reset link has been sent."}

@api_router.post("/auth/reset-password")
async def reset_password(req: ResetPasswordRequest):
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    token_doc = await db.password_reset_tokens.find_one({
        "token": req.token,
        "used": False,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    
    if not token_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Update password
    await db.users.update_one(
        {"_id": ObjectId(token_doc["user_id"])},
        {"$set": {"password_hash": hash_password(req.password)}}
    )
    
    # Mark token as used
    await db.password_reset_tokens.update_one(
        {"_id": token_doc["_id"]},
        {"$set": {"used": True}}
    )
    
    return {"message": "Password reset successfully. You can now login with your new password."}

# ============ OFFERS ROUTES ============

class CreateOfferRequest(BaseModel):
    type: str  # buy/sell
    network: str  # TRC20/ERC20/BEP20
    price_inr: float
    min_limit_inr: float
    max_limit_inr: float
    payment_methods: List[str]
    payment_window_mins: int = 30
    trade_terms: str = ""
    available_usdt: float

@api_router.post("/offers")
async def create_offer(req: CreateOfferRequest, request: Request):
    user = await get_current_user(request)
    if req.price_inr <= 0 or req.available_usdt <= 0 or req.min_limit_inr <= 0 or req.max_limit_inr <= 0:
        raise HTTPException(status_code=400, detail="All amounts must be greater than 0")
    if req.min_limit_inr > req.max_limit_inr:
        raise HTTPException(status_code=400, detail="Min limit cannot exceed max limit")
    offer_doc = {
        "user_id": user["id"],
        "username": user["username"],
        "type": req.type,
        "network": req.network,
        "price_inr": req.price_inr,
        "min_limit_inr": req.min_limit_inr,
        "max_limit_inr": req.max_limit_inr,
        "payment_methods": req.payment_methods,
        "payment_window_mins": req.payment_window_mins,
        "trade_terms": req.trade_terms,
        "available_usdt": req.available_usdt,
        "is_active": True,
        "is_paused": False,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.offers.insert_one(offer_doc)
    return {"id": str(result.inserted_id), "message": "Offer created successfully"}

@api_router.get("/offers")
async def list_offers(type: Optional[str] = None, payment_method: Optional[str] = None, network: Optional[str] = None, sort_by: Optional[str] = "price"):
    query = {"is_active": True, "is_paused": False}
    if type:
        query["type"] = type
    if payment_method:
        query["payment_methods"] = {"$in": [payment_method]}
    if network:
        query["network"] = network
    
    sort_field = "price_inr" if sort_by == "price" else "created_at"
    sort_dir = 1 if type == "sell" else -1
    
    offers_with_id = []
    async for offer in db.offers.find(query).sort(sort_field, sort_dir).limit(100):
        o = {k: v for k, v in offer.items() if k != "_id"}
        o["id"] = str(offer["_id"])
        if "created_at" in o and isinstance(o["created_at"], datetime):
            o["created_at"] = o["created_at"].isoformat()
        # Get user stats
        user = await db.users.find_one({"_id": ObjectId(o["user_id"])}, {"_id": 0, "username": 1, "completed_trades": 1, "total_trades": 1, "completion_rate": 1, "last_seen": 1})
        if user:
            o["user_stats"] = user
            o["user_stats"]["is_verified_trader"] = user.get("completed_trades", 0) >= 50
            if "last_seen" in o["user_stats"] and isinstance(o["user_stats"]["last_seen"], datetime):
                o["user_stats"]["last_seen"] = o["user_stats"]["last_seen"].isoformat()
        offers_with_id.append(o)
    
    return offers_with_id

@api_router.get("/offers/{offer_id}")
async def get_offer(offer_id: str):
    offer = await db.offers.find_one({"_id": ObjectId(offer_id)})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    o = {k: v for k, v in offer.items() if k != "_id"}
    o["id"] = str(offer["_id"])
    if "created_at" in o and isinstance(o["created_at"], datetime):
        o["created_at"] = o["created_at"].isoformat()
    return o

@api_router.get("/my-offers")
async def my_offers(request: Request):
    user = await get_current_user(request)
    offers = []
    async for offer in db.offers.find({"user_id": user["id"]}):
        o = {k: v for k, v in offer.items() if k != "_id"}
        o["id"] = str(offer["_id"])
        if "created_at" in o and isinstance(o["created_at"], datetime):
            o["created_at"] = o["created_at"].isoformat()
        offers.append(o)
    return offers

@api_router.patch("/offers/{offer_id}/toggle")
async def toggle_offer(offer_id: str, request: Request):
    user = await get_current_user(request)
    offer = await db.offers.find_one({"_id": ObjectId(offer_id), "user_id": user["id"]})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    new_status = not offer.get("is_paused", False)
    await db.offers.update_one({"_id": ObjectId(offer_id)}, {"$set": {"is_paused": new_status}})
    return {"is_paused": new_status}

@api_router.delete("/offers/{offer_id}")
async def delete_offer(offer_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.offers.delete_one({"_id": ObjectId(offer_id), "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Offer not found")
    return {"message": "Offer deleted"}

# ============ TRADES ROUTES ============

class InitiateTradeRequest(BaseModel):
    offer_id: str
    amount_usdt: float
    payment_method: str

class UpdateTradeStatusRequest(BaseModel):
    status: str
    dispute_reason: Optional[str] = None

@api_router.post("/trades")
async def initiate_trade(req: InitiateTradeRequest, request: Request):
    user = await get_current_user(request)
    offer = await db.offers.find_one({"_id": ObjectId(req.offer_id)})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if offer["user_id"] == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot trade with yourself")
    
    if req.amount_usdt <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    if req.amount_usdt > offer["available_usdt"]:
        raise HTTPException(status_code=400, detail="Amount exceeds available USDT")
    
    amount_inr = req.amount_usdt * offer["price_inr"]
    
    if amount_inr < offer["min_limit_inr"]:
        raise HTTPException(status_code=400, detail=f"Minimum trade amount is ₹{offer['min_limit_inr']}")
    if amount_inr > offer["max_limit_inr"]:
        raise HTTPException(status_code=400, detail=f"Maximum trade amount is ₹{offer['max_limit_inr']}")
    
    # Determine buyer/seller based on offer type
    if offer["type"] == "sell":
        buyer_id = user["id"]
        seller_id = offer["user_id"]
    else:
        buyer_id = offer["user_id"]
        seller_id = user["id"]
    
    trade_doc = {
        "offer_id": req.offer_id,
        "buyer_id": buyer_id,
        "seller_id": seller_id,
        "amount_usdt": req.amount_usdt,
        "amount_inr": amount_inr,
        "price_inr": offer["price_inr"],
        "payment_method": req.payment_method,
        "network": offer["network"],
        "status": "INITIATED",
        "dispute_reason": None,
        "dispute_raised_by": None,
        "admin_note": None,
        "resolved_by": None,
        "payment_proof_url": None,
        "payment_window_mins": offer.get("payment_window_mins", 30),
        "trade_terms": offer.get("trade_terms", ""),
        "created_at": datetime.now(timezone.utc),
        "payment_sent_at": None,
        "completed_at": None,
        "expired_at": None,
    }
    
    result = await db.trades.insert_one(trade_doc)
    trade_id = str(result.inserted_id)
    
    # Create system message
    await db.messages.insert_one({
        "trade_id": trade_id,
        "sender_id": "system",
        "message": f"Trade initiated by {user['username']}",
        "message_type": "system",
        "is_read": False,
        "created_at": datetime.now(timezone.utc),
    })
    
    # Create notification for other party
    notify_user = seller_id if user["id"] == buyer_id else buyer_id
    await db.notifications.insert_one({
        "user_id": notify_user,
        "type": "trade_initiated",
        "message": f"New trade initiated - {req.amount_usdt} USDT",
        "trade_id": trade_id,
        "is_read": False,
        "created_at": datetime.now(timezone.utc),
    })
    
    # Update offer available amount
    new_available = offer["available_usdt"] - req.amount_usdt
    await db.offers.update_one({"_id": ObjectId(req.offer_id)}, {"$set": {"available_usdt": max(0, new_available)}})
    
    return {"id": trade_id, "message": "Trade initiated"}

@api_router.get("/trades")
async def list_trades(request: Request, status: Optional[str] = None):
    user = await get_current_user(request)
    query = {"$or": [{"buyer_id": user["id"]}, {"seller_id": user["id"]}]}
    if status:
        query["status"] = status
    
    trades = []
    async for trade in db.trades.find(query).sort("created_at", -1):
        t = {k: v for k, v in trade.items() if k != "_id"}
        t["id"] = str(trade["_id"])
        for dt_field in ["created_at", "payment_sent_at", "completed_at", "expired_at"]:
            if t.get(dt_field) and isinstance(t[dt_field], datetime):
                t[dt_field] = t[dt_field].isoformat()
        # Get counterparty info
        counterparty_id = t["seller_id"] if t["buyer_id"] == user["id"] else t["buyer_id"]
        cp = await db.users.find_one({"_id": ObjectId(counterparty_id)}, {"_id": 0, "username": 1})
        t["counterparty"] = cp.get("username", "Unknown") if cp else "Unknown"
        t["is_buyer"] = t["buyer_id"] == user["id"]
        trades.append(t)
    return trades

@api_router.get("/trades/{trade_id}")
async def get_trade(trade_id: str, request: Request):
    user = await get_current_user(request)
    trade = await db.trades.find_one({"_id": ObjectId(trade_id)})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    # Only buyer, seller, or admin can view
    if user["id"] not in [trade["buyer_id"], trade["seller_id"]] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    t = {k: v for k, v in trade.items() if k != "_id"}
    t["id"] = str(trade["_id"])
    for dt_field in ["created_at", "payment_sent_at", "completed_at", "expired_at"]:
        if t.get(dt_field) and isinstance(t[dt_field], datetime):
            t[dt_field] = t[dt_field].isoformat()
    
    # Get buyer/seller info
    buyer = await db.users.find_one({"_id": ObjectId(t["buyer_id"])}, {"_id": 0, "username": 1, "completed_trades": 1, "completion_rate": 1})
    seller = await db.users.find_one({"_id": ObjectId(t["seller_id"])}, {"_id": 0, "username": 1, "completed_trades": 1, "completion_rate": 1})
    t["buyer_info"] = buyer or {}
    t["seller_info"] = seller or {}
    t["is_buyer"] = user["id"] == t["buyer_id"]
    t["is_seller"] = user["id"] == t["seller_id"]
    
    return t

@api_router.patch("/trades/{trade_id}/status")
async def update_trade_status(trade_id: str, req: UpdateTradeStatusRequest, request: Request):
    user = await get_current_user(request)
    trade = await db.trades.find_one({"_id": ObjectId(trade_id)})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    if user["id"] not in [trade["buyer_id"], trade["seller_id"]] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = {"status": req.status}
    notification_msg = ""
    
    if req.status == "PAYMENT_SENT":
        update_data["payment_sent_at"] = datetime.now(timezone.utc)
        notification_msg = "Payment marked as sent"
    elif req.status == "COMPLETED":
        update_data["completed_at"] = datetime.now(timezone.utc)
        notification_msg = "Trade completed - USDT released"
        # Update user stats
        for uid in [trade["buyer_id"], trade["seller_id"]]:
            await db.users.update_one({"_id": ObjectId(uid)}, {
                "$inc": {"total_trades": 1, "completed_trades": 1}
            })
            u = await db.users.find_one({"_id": ObjectId(uid)})
            if u and u.get("total_trades", 0) > 0:
                rate = (u.get("completed_trades", 0) / u["total_trades"]) * 100
                await db.users.update_one({"_id": ObjectId(uid)}, {"$set": {"completion_rate": round(rate, 1)}})
    elif req.status == "DISPUTED":
        update_data["dispute_reason"] = req.dispute_reason
        update_data["dispute_raised_by"] = user["id"]
        notification_msg = "Dispute raised on trade"
    elif req.status == "CANCELLED":
        notification_msg = "Trade cancelled"
        # Return USDT to offer
        offer = await db.offers.find_one({"_id": ObjectId(trade["offer_id"])})
        if offer:
            await db.offers.update_one({"_id": ObjectId(trade["offer_id"])}, {"$inc": {"available_usdt": trade["amount_usdt"]}})
    
    await db.trades.update_one({"_id": ObjectId(trade_id)}, {"$set": update_data})
    
    # System message
    await db.messages.insert_one({
        "trade_id": trade_id,
        "sender_id": "system",
        "message": notification_msg,
        "message_type": "system",
        "is_read": False,
        "created_at": datetime.now(timezone.utc),
    })
    
    # Notification
    notify_user = trade["seller_id"] if user["id"] == trade["buyer_id"] else trade["buyer_id"]
    await db.notifications.insert_one({
        "user_id": notify_user,
        "type": f"trade_{req.status.lower()}",
        "message": notification_msg,
        "trade_id": trade_id,
        "is_read": False,
        "created_at": datetime.now(timezone.utc),
    })
    
    # WebSocket broadcast
    await ws_manager.broadcast_to_trade(trade_id, {
        "type": "status_update",
        "status": req.status,
        "message": notification_msg,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    
    # Email notification
    trade_email_data = {"id": trade_id, "amount_usdt": trade["amount_usdt"], "amount_inr": trade["amount_inr"], "dispute_reason": req.dispute_reason}
    email_event_map = {"PAYMENT_SENT": "payment_sent", "COMPLETED": "trade_completed", "DISPUTED": "dispute_raised"}
    if req.status in email_event_map:
        asyncio.create_task(send_trade_email(notify_user, email_event_map[req.status], trade_email_data))
    
    return {"message": f"Trade status updated to {req.status}"}

@api_router.post("/trades/{trade_id}/upload-proof")
async def upload_payment_proof(trade_id: str, request: Request, file: UploadFile = File(...)):
    user = await get_current_user(request)
    trade = await db.trades.find_one({"_id": ObjectId(trade_id)})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    if user["id"] not in [trade["buyer_id"], trade["seller_id"]]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Save file
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"{trade_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOAD_DIR / filename
    
    async with aiofiles.open(filepath, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    proof_url = f"/api/uploads/{filename}"
    await db.trades.update_one({"_id": ObjectId(trade_id)}, {"$set": {"payment_proof_url": proof_url}})
    
    return {"url": proof_url}

@api_router.get("/uploads/{filename}")
async def serve_upload(filename: str):
    from fastapi.responses import FileResponse
    filepath = UPLOAD_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(filepath)

# ============ MESSAGES ROUTES ============

class SendMessageRequest(BaseModel):
    message: str
    message_type: str = "text"

@api_router.get("/trades/{trade_id}/messages")
async def get_messages(trade_id: str, request: Request):
    user = await get_current_user(request)
    trade = await db.trades.find_one({"_id": ObjectId(trade_id)})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    if user["id"] not in [trade["buyer_id"], trade["seller_id"]] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    messages = []
    async for msg in db.messages.find({"trade_id": trade_id}).sort("created_at", 1):
        m = {k: v for k, v in msg.items() if k != "_id"}
        m["id"] = str(msg["_id"])
        if "created_at" in m and isinstance(m["created_at"], datetime):
            m["created_at"] = m["created_at"].isoformat()
        # Get sender username
        if m["sender_id"] != "system":
            sender = await db.users.find_one({"_id": ObjectId(m["sender_id"])}, {"_id": 0, "username": 1})
            m["sender_username"] = sender.get("username", "Unknown") if sender else "Unknown"
        else:
            m["sender_username"] = "System"
        messages.append(m)
    return messages

@api_router.post("/trades/{trade_id}/messages")
async def send_message(trade_id: str, req: SendMessageRequest, request: Request):
    user = await get_current_user(request)
    trade = await db.trades.find_one({"_id": ObjectId(trade_id)})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    if user["id"] not in [trade["buyer_id"], trade["seller_id"]]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    msg_doc = {
        "trade_id": trade_id,
        "sender_id": user["id"],
        "message": req.message,
        "message_type": req.message_type,
        "is_read": False,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.messages.insert_one(msg_doc)
    
    # WebSocket broadcast
    await ws_manager.broadcast_to_trade(trade_id, {
        "type": "new_message",
        "id": str(result.inserted_id),
        "sender_id": user["id"],
        "sender_username": user["username"],
        "message": req.message,
        "message_type": req.message_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    return {"id": str(result.inserted_id), "message": "Message sent"}

# ============ WEBSOCKET ENDPOINT ============

@app.websocket("/api/ws/trade/{trade_id}")
async def websocket_trade(websocket: WebSocket, trade_id: str):
    """WebSocket endpoint for real-time trade chat and status updates"""
    # Authenticate via query param token
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001)
        return
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload["sub"]
    except jwt.InvalidTokenError:
        await websocket.close(code=4001)
        return
    
    # Verify user is part of this trade
    trade = await db.trades.find_one({"_id": ObjectId(trade_id)})
    if not trade or user_id not in [trade["buyer_id"], trade["seller_id"]]:
        await websocket.close(code=4003)
        return
    
    await ws_manager.connect(websocket, trade_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming messages from WebSocket
            try:
                msg_data = json.loads(data)
                if msg_data.get("type") == "message":
                    user = await db.users.find_one({"_id": ObjectId(user_id)}, {"_id": 0, "username": 1})
                    msg_doc = {
                        "trade_id": trade_id,
                        "sender_id": user_id,
                        "message": msg_data.get("message", ""),
                        "message_type": "text",
                        "is_read": False,
                        "created_at": datetime.now(timezone.utc),
                    }
                    result = await db.messages.insert_one(msg_doc)
                    await ws_manager.broadcast_to_trade(trade_id, {
                        "type": "new_message",
                        "id": str(result.inserted_id),
                        "sender_id": user_id,
                        "sender_username": user.get("username", "Unknown") if user else "Unknown",
                        "message": msg_data.get("message", ""),
                        "message_type": "text",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    })
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, trade_id)

# ============ REVIEWS ROUTES ============

class CreateReviewRequest(BaseModel):
    rating: int
    comment: str = ""

@api_router.post("/trades/{trade_id}/review")
async def create_review(trade_id: str, req: CreateReviewRequest, request: Request):
    user = await get_current_user(request)
    trade = await db.trades.find_one({"_id": ObjectId(trade_id)})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    if trade["status"] != "COMPLETED":
        raise HTTPException(status_code=400, detail="Can only review completed trades")
    if user["id"] not in [trade["buyer_id"], trade["seller_id"]]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if already reviewed
    existing = await db.reviews.find_one({"trade_id": trade_id, "reviewer_id": user["id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Already reviewed this trade")
    
    reviewed_id = trade["seller_id"] if user["id"] == trade["buyer_id"] else trade["buyer_id"]
    
    review_doc = {
        "trade_id": trade_id,
        "reviewer_id": user["id"],
        "reviewed_id": reviewed_id,
        "rating": min(5, max(1, req.rating)),
        "comment": req.comment,
        "created_at": datetime.now(timezone.utc),
    }
    await db.reviews.insert_one(review_doc)
    return {"message": "Review submitted"}

@api_router.get("/users/{username}/reviews")
async def get_user_reviews(username: str):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    reviews = []
    async for review in db.reviews.find({"reviewed_id": str(user["_id"])}).sort("created_at", -1).limit(20):
        r = {k: v for k, v in review.items() if k != "_id"}
        r["id"] = str(review["_id"])
        if "created_at" in r and isinstance(r["created_at"], datetime):
            r["created_at"] = r["created_at"].isoformat()
        reviewer = await db.users.find_one({"_id": ObjectId(r["reviewer_id"])}, {"_id": 0, "username": 1})
        r["reviewer_username"] = reviewer.get("username", "Unknown") if reviewer else "Unknown"
        reviews.append(r)
    return reviews

# ============ NOTIFICATIONS ROUTES ============

@api_router.get("/notifications")
async def get_notifications(request: Request):
    user = await get_current_user(request)
    notifications = []
    async for notif in db.notifications.find({"user_id": user["id"]}).sort("created_at", -1).limit(50):
        n = {k: v for k, v in notif.items() if k != "_id"}
        n["id"] = str(notif["_id"])
        if "created_at" in n and isinstance(n["created_at"], datetime):
            n["created_at"] = n["created_at"].isoformat()
        notifications.append(n)
    return notifications

@api_router.get("/notifications/unread-count")
async def unread_count(request: Request):
    user = await get_current_user(request)
    count = await db.notifications.count_documents({"user_id": user["id"], "is_read": False})
    return {"count": count}

@api_router.patch("/notifications/mark-read")
async def mark_notifications_read(request: Request):
    user = await get_current_user(request)
    await db.notifications.update_many({"user_id": user["id"], "is_read": False}, {"$set": {"is_read": True}})
    return {"message": "Marked as read"}

# ============ USER PROFILE ROUTES ============

@api_router.get("/users/{username}")
async def get_user_profile(username: str):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    profile = serialize_user(user)
    # Get active offers
    offers = []
    async for offer in db.offers.find({"user_id": str(user["_id"]), "is_active": True, "is_paused": False}).limit(10):
        o = {k: v for k, v in offer.items() if k != "_id"}
        o["id"] = str(offer["_id"])
        if "created_at" in o and isinstance(o["created_at"], datetime):
            o["created_at"] = o["created_at"].isoformat()
        offers.append(o)
    profile["offers"] = offers
    return profile

@api_router.patch("/users/profile")
async def update_profile(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    allowed_fields = ["username", "wallet_address"]
    update = {k: v for k, v in body.items() if k in allowed_fields}
    if "username" in update:
        existing = await db.users.find_one({"username": update["username"], "_id": {"$ne": ObjectId(user["id"])}})
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
    if update:
        await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": update})
    return {"message": "Profile updated"}

# ============ STATS ROUTES ============

@api_router.get("/stats")
async def get_stats():
    total_offers = await db.offers.count_documents({"is_active": True})
    total_trades = await db.trades.count_documents({})
    completed_trades = await db.trades.count_documents({"status": "COMPLETED"})
    
    # Calculate volume
    pipeline = [{"$match": {"status": "COMPLETED"}}, {"$group": {"_id": None, "total": {"$sum": "$amount_inr"}}}]
    volume_result = await db.trades.aggregate(pipeline).to_list(1)
    total_volume = volume_result[0]["total"] if volume_result else 0
    
    return {
        "total_offers": total_offers,
        "total_trades": total_trades,
        "completed_trades": completed_trades,
        "total_volume_inr": total_volume,
        "payment_methods": 6,
    }

# ============ ADMIN ROUTES ============

@api_router.get("/admin/stats")
async def admin_stats(request: Request):
    await get_admin_user(request)
    total_users = await db.users.count_documents({})
    active_users_24h = await db.users.count_documents({"last_seen": {"$gte": datetime.now(timezone.utc) - timedelta(hours=24)}})
    total_trades_today = await db.trades.count_documents({"created_at": {"$gte": datetime.now(timezone.utc) - timedelta(hours=24)}})
    open_disputes = await db.trades.count_documents({"status": "DISPUTED"})
    total_offers = await db.offers.count_documents({})
    
    pipeline = [{"$match": {"status": "COMPLETED", "completed_at": {"$gte": datetime.now(timezone.utc) - timedelta(hours=24)}}}, {"$group": {"_id": None, "total": {"$sum": "$amount_inr"}}}]
    vol = await db.trades.aggregate(pipeline).to_list(1)
    volume_today = vol[0]["total"] if vol else 0
    
    return {
        "total_users": total_users,
        "active_users_24h": active_users_24h,
        "total_trades_today": total_trades_today,
        "open_disputes": open_disputes,
        "total_offers": total_offers,
        "volume_today": volume_today,
    }

@api_router.get("/admin/users")
async def admin_list_users(request: Request, search: Optional[str] = None):
    await get_admin_user(request)
    query = {}
    if search:
        query = {"$or": [{"username": {"$regex": search, "$options": "i"}}, {"email": {"$regex": search, "$options": "i"}}]}
    
    users = []
    async for user in db.users.find(query).sort("created_at", -1).limit(100):
        users.append(serialize_user(user))
    return users

@api_router.patch("/admin/users/{user_id}/ban")
async def admin_ban_user(user_id: str, request: Request):
    admin = await get_admin_user(request)
    body = await request.json()
    is_banned = body.get("is_banned", True)
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"is_banned": is_banned}})
    
    # Log action
    await db.admin_logs.insert_one({
        "admin_id": admin["id"],
        "action": "ban_user" if is_banned else "unban_user",
        "target_user_id": user_id,
        "note": body.get("reason", ""),
        "created_at": datetime.now(timezone.utc),
    })
    return {"message": "User banned" if is_banned else "User unbanned"}

@api_router.get("/admin/trades")
async def admin_list_trades(request: Request, status: Optional[str] = None):
    await get_admin_user(request)
    query = {}
    if status:
        query["status"] = status
    
    trades = []
    async for trade in db.trades.find(query).sort("created_at", -1).limit(100):
        t = {k: v for k, v in trade.items() if k != "_id"}
        t["id"] = str(trade["_id"])
        for dt_field in ["created_at", "payment_sent_at", "completed_at", "expired_at"]:
            if t.get(dt_field) and isinstance(t[dt_field], datetime):
                t[dt_field] = t[dt_field].isoformat()
        # Get buyer/seller usernames
        buyer = await db.users.find_one({"_id": ObjectId(t["buyer_id"])}, {"_id": 0, "username": 1})
        seller = await db.users.find_one({"_id": ObjectId(t["seller_id"])}, {"_id": 0, "username": 1})
        t["buyer_username"] = buyer.get("username", "Unknown") if buyer else "Unknown"
        t["seller_username"] = seller.get("username", "Unknown") if seller else "Unknown"
        trades.append(t)
    return trades

@api_router.get("/admin/disputes")
async def admin_list_disputes(request: Request):
    await get_admin_user(request)
    trades = []
    async for trade in db.trades.find({"status": "DISPUTED"}).sort("created_at", 1):
        t = {k: v for k, v in trade.items() if k != "_id"}
        t["id"] = str(trade["_id"])
        for dt_field in ["created_at", "payment_sent_at", "completed_at", "expired_at"]:
            if t.get(dt_field) and isinstance(t[dt_field], datetime):
                t[dt_field] = t[dt_field].isoformat()
        buyer = await db.users.find_one({"_id": ObjectId(t["buyer_id"])}, {"_id": 0, "username": 1})
        seller = await db.users.find_one({"_id": ObjectId(t["seller_id"])}, {"_id": 0, "username": 1})
        t["buyer_username"] = buyer.get("username", "Unknown") if buyer else "Unknown"
        t["seller_username"] = seller.get("username", "Unknown") if seller else "Unknown"
        trades.append(t)
    return trades

class ResolveDisputeRequest(BaseModel):
    resolution: str  # release_buyer, release_seller, cancel
    admin_note: str

@api_router.post("/admin/trades/{trade_id}/resolve")
async def admin_resolve_dispute(trade_id: str, req: ResolveDisputeRequest, request: Request):
    admin = await get_admin_user(request)
    trade = await db.trades.find_one({"_id": ObjectId(trade_id)})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    update_data = {"admin_note": req.admin_note, "resolved_by": admin["id"]}
    
    if req.resolution == "release_buyer":
        update_data["status"] = "COMPLETED"
        update_data["completed_at"] = datetime.now(timezone.utc)
        # Add strike to seller
        await db.users.update_one({"_id": ObjectId(trade["seller_id"])}, {"$inc": {"strikes": 1}})
        seller = await db.users.find_one({"_id": ObjectId(trade["seller_id"])})
        if seller and seller.get("strikes", 0) >= 3:
            await db.users.update_one({"_id": ObjectId(trade["seller_id"])}, {"$set": {"is_banned": True}})
    elif req.resolution == "release_seller":
        update_data["status"] = "COMPLETED"
        update_data["completed_at"] = datetime.now(timezone.utc)
        await db.users.update_one({"_id": ObjectId(trade["buyer_id"])}, {"$inc": {"strikes": 1}})
        buyer = await db.users.find_one({"_id": ObjectId(trade["buyer_id"])})
        if buyer and buyer.get("strikes", 0) >= 3:
            await db.users.update_one({"_id": ObjectId(trade["buyer_id"])}, {"$set": {"is_banned": True}})
    elif req.resolution == "cancel":
        update_data["status"] = "CANCELLED"
        # Return USDT
        await db.offers.update_one({"_id": ObjectId(trade["offer_id"])}, {"$inc": {"available_usdt": trade["amount_usdt"]}})
    
    await db.trades.update_one({"_id": ObjectId(trade_id)}, {"$set": update_data})
    
    # Log
    await db.admin_logs.insert_one({
        "admin_id": admin["id"],
        "action": f"resolve_dispute_{req.resolution}",
        "target_trade_id": trade_id,
        "note": req.admin_note,
        "created_at": datetime.now(timezone.utc),
    })
    
    # Notify both parties
    for uid in [trade["buyer_id"], trade["seller_id"]]:
        await db.notifications.insert_one({
            "user_id": uid,
            "type": "dispute_resolved",
            "message": f"Dispute resolved by admin: {req.admin_note}",
            "trade_id": trade_id,
            "is_read": False,
            "created_at": datetime.now(timezone.utc),
        })
    
    return {"message": "Dispute resolved"}

@api_router.get("/admin/offers")
async def admin_list_offers(request: Request):
    await get_admin_user(request)
    offers = []
    async for offer in db.offers.find().sort("created_at", -1).limit(100):
        o = {k: v for k, v in offer.items() if k != "_id"}
        o["id"] = str(offer["_id"])
        if "created_at" in o and isinstance(o["created_at"], datetime):
            o["created_at"] = o["created_at"].isoformat()
        offers.append(o)
    return offers

@api_router.delete("/admin/offers/{offer_id}")
async def admin_delete_offer(offer_id: str, request: Request):
    await get_admin_user(request)
    await db.offers.delete_one({"_id": ObjectId(offer_id)})
    return {"message": "Offer deleted"}

# ============ ANALYTICS ============

@api_router.get("/admin/analytics")
async def admin_analytics(request: Request, days: int = 30):
    await get_admin_user(request)
    
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    
    # Daily trades and volume for the last N days
    pipeline = [
        {"$match": {"created_at": {"$gte": start}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "trades_count": {"$sum": 1},
            "volume_inr": {"$sum": "$amount_inr"},
            "volume_usdt": {"$sum": "$amount_usdt"},
            "completed": {"$sum": {"$cond": [{"$eq": ["$status", "COMPLETED"]}, 1, 0]}},
            "disputed": {"$sum": {"$cond": [{"$eq": ["$status", "DISPUTED"]}, 1, 0]}},
        }},
        {"$sort": {"_id": 1}},
    ]
    daily_trades = await db.trades.aggregate(pipeline).to_list(60)
    
    # Daily new users
    user_pipeline = [
        {"$match": {"created_at": {"$gte": start}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "new_users": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    daily_users = await db.users.aggregate(user_pipeline).to_list(60)
    
    # Payment method breakdown
    payment_pipeline = [
        {"$match": {"created_at": {"$gte": start}}},
        {"$group": {
            "_id": "$payment_method",
            "count": {"$sum": 1},
            "volume": {"$sum": "$amount_inr"},
        }},
        {"$sort": {"count": -1}},
    ]
    payment_breakdown = await db.trades.aggregate(payment_pipeline).to_list(20)
    
    # Network breakdown
    network_pipeline = [
        {"$match": {"created_at": {"$gte": start}}},
        {"$group": {
            "_id": "$network",
            "count": {"$sum": 1},
            "volume": {"$sum": "$amount_inr"},
        }},
        {"$sort": {"count": -1}},
    ]
    network_breakdown = await db.trades.aggregate(network_pipeline).to_list(10)
    
    # Status breakdown
    status_pipeline = [
        {"$match": {"created_at": {"$gte": start}}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
        }},
    ]
    status_breakdown = await db.trades.aggregate(status_pipeline).to_list(10)
    
    # Summary totals
    total_volume = sum(d.get("volume_inr", 0) for d in daily_trades)
    total_trades = sum(d.get("trades_count", 0) for d in daily_trades)
    total_completed = sum(d.get("completed", 0) for d in daily_trades)
    total_new_users = sum(d.get("new_users", 0) for d in daily_users)
    
    # Previous period comparison for trends
    prev_start = start - timedelta(days=days)
    prev_pipeline = [
        {"$match": {"created_at": {"$gte": prev_start, "$lt": start}}},
        {"$group": {
            "_id": None,
            "trades_count": {"$sum": 1},
            "volume_inr": {"$sum": "$amount_inr"},
            "completed": {"$sum": {"$cond": [{"$eq": ["$status", "COMPLETED"]}, 1, 0]}},
        }},
    ]
    prev_result = await db.trades.aggregate(prev_pipeline).to_list(1)
    prev_volume = prev_result[0]["volume_inr"] if prev_result else 0
    prev_trades = prev_result[0]["trades_count"] if prev_result else 0
    
    prev_users_pipeline = [
        {"$match": {"created_at": {"$gte": prev_start, "$lt": start}}},
        {"$group": {"_id": None, "count": {"$sum": 1}}},
    ]
    prev_users_result = await db.users.aggregate(prev_users_pipeline).to_list(1)
    prev_new_users = prev_users_result[0]["count"] if prev_users_result else 0
    
    def calc_trend(current, previous):
        if previous == 0:
            return 100.0 if current > 0 else 0.0
        return round(((current - previous) / previous) * 100, 1)
    
    return {
        "daily_trades": [{"date": d["_id"], "trades": d["trades_count"], "volume_inr": d["volume_inr"], "volume_usdt": d["volume_usdt"], "completed": d["completed"], "disputed": d["disputed"]} for d in daily_trades],
        "daily_users": [{"date": d["_id"], "new_users": d["new_users"]} for d in daily_users],
        "payment_breakdown": [{"method": d["_id"] or "Unknown", "count": d["count"], "volume": d["volume"]} for d in payment_breakdown],
        "network_breakdown": [{"network": d["_id"] or "Unknown", "count": d["count"], "volume": d["volume"]} for d in network_breakdown],
        "status_breakdown": [{"status": d["_id"] or "Unknown", "count": d["count"]} for d in status_breakdown],
        "summary": {
            "total_volume_inr": total_volume,
            "total_trades": total_trades,
            "total_completed": total_completed,
            "total_new_users": total_new_users,
            "completion_rate": round((total_completed / total_trades * 100) if total_trades > 0 else 0, 1),
        },
        "trends": {
            "volume_change": calc_trend(total_volume, prev_volume),
            "trades_change": calc_trend(total_trades, prev_trades),
            "users_change": calc_trend(total_new_users, prev_new_users),
        },
        "period_days": days,
    }

# ============ TOP TRADERS LEADERBOARD ============

@api_router.get("/admin/top-traders")
async def admin_top_traders(request: Request, days: int = 30, limit: int = 10):
    await get_admin_user(request)
    
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    
    # Top traders by volume (as buyer)
    buyer_pipeline = [
        {"$match": {"created_at": {"$gte": start}, "status": {"$in": ["COMPLETED", "PAYMENT_SENT", "INITIATED"]}}},
        {"$group": {
            "_id": "$buyer_id",
            "trades_count": {"$sum": 1},
            "volume_inr": {"$sum": "$amount_inr"},
            "volume_usdt": {"$sum": "$amount_usdt"},
            "completed": {"$sum": {"$cond": [{"$eq": ["$status", "COMPLETED"]}, 1, 0]}},
        }},
    ]
    buyer_stats = {d["_id"]: d for d in await db.trades.aggregate(buyer_pipeline).to_list(500)}
    
    # Top traders by volume (as seller)
    seller_pipeline = [
        {"$match": {"created_at": {"$gte": start}, "status": {"$in": ["COMPLETED", "PAYMENT_SENT", "INITIATED"]}}},
        {"$group": {
            "_id": "$seller_id",
            "trades_count": {"$sum": 1},
            "volume_inr": {"$sum": "$amount_inr"},
            "volume_usdt": {"$sum": "$amount_usdt"},
            "completed": {"$sum": {"$cond": [{"$eq": ["$status", "COMPLETED"]}, 1, 0]}},
        }},
    ]
    seller_stats = {d["_id"]: d for d in await db.trades.aggregate(seller_pipeline).to_list(500)}
    
    # Merge buyer + seller stats per user
    all_user_ids = set(list(buyer_stats.keys()) + list(seller_stats.keys()))
    merged = []
    for uid in all_user_ids:
        b = buyer_stats.get(uid, {"trades_count": 0, "volume_inr": 0, "volume_usdt": 0, "completed": 0})
        s = seller_stats.get(uid, {"trades_count": 0, "volume_inr": 0, "volume_usdt": 0, "completed": 0})
        merged.append({
            "user_id": uid,
            "total_trades": b["trades_count"] + s["trades_count"],
            "total_volume_inr": b["volume_inr"] + s["volume_inr"],
            "total_volume_usdt": b["volume_usdt"] + s["volume_usdt"],
            "completed_trades": b["completed"] + s["completed"],
            "buy_trades": b["trades_count"],
            "sell_trades": s["trades_count"],
        })
    
    # Sort by volume
    merged.sort(key=lambda x: x["total_volume_inr"], reverse=True)
    top = merged[:limit]
    
    # Enrich with user info
    result = []
    for i, trader in enumerate(top):
        user = await db.users.find_one({"_id": ObjectId(trader["user_id"])}, {"_id": 0, "username": 1, "completion_rate": 1, "created_at": 1})
        if user:
            result.append({
                "rank": i + 1,
                "username": user.get("username", "Unknown"),
                "completion_rate": user.get("completion_rate", 0),
                "total_trades": trader["total_trades"],
                "total_volume_inr": trader["total_volume_inr"],
                "total_volume_usdt": trader["total_volume_usdt"],
                "completed_trades": trader["completed_trades"],
                "buy_trades": trader["buy_trades"],
                "sell_trades": trader["sell_trades"],
            })
    
    return result

# ============ PUBLIC TOP TRADERS (for homepage/dashboard) ============

@api_router.get("/top-traders")
async def public_top_traders(days: int = 30, limit: int = 5):
    """Public leaderboard - shows limited info. Falls back to all-time top users if no completed trades in period."""
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    
    # Try completed trades first
    pipeline = [
        {"$match": {"created_at": {"$gte": start}, "status": "COMPLETED"}},
        {"$group": {
            "_id": "$seller_id",
            "trades_count": {"$sum": 1},
            "volume_usdt": {"$sum": "$amount_usdt"},
        }},
        {"$sort": {"trades_count": -1}},
        {"$limit": limit},
    ]
    top_sellers = await db.trades.aggregate(pipeline).to_list(limit)
    
    # Fallback: get top users by completed_trades from users collection
    if not top_sellers:
        result = []
        async for user in db.users.find({"completed_trades": {"$gt": 0}}).sort("completed_trades", -1).limit(limit):
            result.append({
                "rank": len(result) + 1,
                "username": user.get("username", "Unknown"),
                "completed_trades": user.get("completed_trades", 0),
                "completion_rate": user.get("completion_rate", 0),
                "volume_usdt": 0,
                "is_verified_trader": user.get("completed_trades", 0) >= 50,
            })
        # If still empty, show users with active offers as "active traders"
        if not result:
            async for offer in db.offers.find({"is_active": True}).sort("created_at", -1).limit(limit):
                user = await db.users.find_one({"_id": ObjectId(offer["user_id"])}, {"_id": 0, "username": 1, "completion_rate": 1, "completed_trades": 1, "total_trades": 1})
                if user and not any(r["username"] == user.get("username") for r in result):
                    result.append({
                        "rank": len(result) + 1,
                        "username": user.get("username", "Unknown"),
                        "completed_trades": user.get("completed_trades", 0),
                        "completion_rate": user.get("completion_rate", 0),
                        "volume_usdt": offer.get("available_usdt", 0),
                        "is_verified_trader": user.get("completed_trades", 0) >= 50,
                    })
        return result
    
    result = []
    for i, t in enumerate(top_sellers):
        user = await db.users.find_one({"_id": ObjectId(t["_id"])}, {"_id": 0, "username": 1, "completion_rate": 1, "completed_trades": 1})
        if user:
            result.append({
                "rank": i + 1,
                "username": user.get("username", "Unknown"),
                "completed_trades": user.get("completed_trades", 0),
                "completion_rate": user.get("completion_rate", 0),
                "volume_usdt": t["volume_usdt"],
                "is_verified_trader": user.get("completed_trades", 0) >= 50,
            })
    return result

# ============ CSV EXPORT ============

@api_router.get("/admin/export/trades")
async def export_trades_csv(request: Request, start_date: Optional[str] = None, end_date: Optional[str] = None):
    await get_admin_user(request)
    
    query = {}
    if start_date:
        query["created_at"] = {"$gte": datetime.fromisoformat(start_date)}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = datetime.fromisoformat(end_date) + timedelta(days=1)
        else:
            query["created_at"] = {"$lte": datetime.fromisoformat(end_date) + timedelta(days=1)}
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Trade ID", "Buyer", "Seller", "Amount USDT", "Amount INR", "Price INR", "Payment Method", "Network", "Status", "Created At", "Completed At"])
    
    async for trade in db.trades.find(query).sort("created_at", -1).limit(5000):
        buyer = await db.users.find_one({"_id": ObjectId(trade["buyer_id"])}, {"_id": 0, "username": 1})
        seller = await db.users.find_one({"_id": ObjectId(trade["seller_id"])}, {"_id": 0, "username": 1})
        writer.writerow([
            str(trade["_id"]),
            buyer.get("username", "Unknown") if buyer else "Unknown",
            seller.get("username", "Unknown") if seller else "Unknown",
            trade.get("amount_usdt", 0),
            trade.get("amount_inr", 0),
            trade.get("price_inr", 0),
            trade.get("payment_method", ""),
            trade.get("network", ""),
            trade.get("status", ""),
            trade.get("created_at", "").isoformat() if isinstance(trade.get("created_at"), datetime) else str(trade.get("created_at", "")),
            trade.get("completed_at", "").isoformat() if isinstance(trade.get("completed_at"), datetime) else str(trade.get("completed_at", "")),
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=trades_export_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"}
    )

@api_router.get("/admin/export/users")
async def export_users_csv(request: Request, start_date: Optional[str] = None, end_date: Optional[str] = None):
    await get_admin_user(request)
    
    query = {}
    if start_date:
        query["created_at"] = {"$gte": datetime.fromisoformat(start_date)}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = datetime.fromisoformat(end_date) + timedelta(days=1)
        else:
            query["created_at"] = {"$lte": datetime.fromisoformat(end_date) + timedelta(days=1)}
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["User ID", "Username", "Email", "Role", "Total Trades", "Completed Trades", "Completion Rate", "Strikes", "Is Banned", "Created At"])
    
    async for user in db.users.find(query).sort("created_at", -1).limit(5000):
        writer.writerow([
            str(user["_id"]),
            user.get("username", ""),
            user.get("email", ""),
            user.get("role", "user"),
            user.get("total_trades", 0),
            user.get("completed_trades", 0),
            user.get("completion_rate", 0),
            user.get("strikes", 0),
            user.get("is_banned", False),
            user.get("created_at", "").isoformat() if isinstance(user.get("created_at"), datetime) else str(user.get("created_at", "")),
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=users_export_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"}
    )

# ============ TRADE AUTO-EXPIRY BACKGROUND TASK ============

async def check_expired_trades():
    """Background task to auto-expire trades that exceeded payment window"""
    while True:
        try:
            # Find trades that are INITIATED and past their payment window
            now = datetime.now(timezone.utc)
            async for trade in db.trades.find({"status": "INITIATED"}):
                created_at = trade.get("created_at")
                if not created_at:
                    continue
                # Handle both timezone-aware and naive datetimes
                if isinstance(created_at, datetime):
                    if created_at.tzinfo is None:
                        created_at = created_at.replace(tzinfo=timezone.utc)
                else:
                    continue
                window_mins = trade.get("payment_window_mins", 30)
                deadline = created_at + timedelta(minutes=window_mins)
                
                if now > deadline:
                    # Expire the trade
                    await db.trades.update_one(
                        {"_id": trade["_id"]},
                        {"$set": {"status": "EXPIRED", "expired_at": now}}
                    )
                    
                    # Return USDT to offer
                    await db.offers.update_one(
                        {"_id": ObjectId(trade["offer_id"])},
                        {"$inc": {"available_usdt": trade["amount_usdt"]}}
                    )
                    
                    trade_id = str(trade["_id"])
                    
                    # System message
                    await db.messages.insert_one({
                        "trade_id": trade_id,
                        "sender_id": "system",
                        "message": "Trade expired - payment window exceeded",
                        "message_type": "system",
                        "is_read": False,
                        "created_at": now,
                    })
                    
                    # Notify both parties
                    for uid in [trade["buyer_id"], trade["seller_id"]]:
                        await db.notifications.insert_one({
                            "user_id": uid,
                            "type": "trade_expired",
                            "message": f"Trade expired - payment window of {window_mins} minutes exceeded",
                            "trade_id": trade_id,
                            "is_read": False,
                            "created_at": now,
                        })
                        asyncio.create_task(send_trade_email(uid, "trade_expired", {"id": trade_id, "amount_usdt": trade["amount_usdt"], "amount_inr": trade["amount_inr"]}))
                    
                    # WebSocket broadcast
                    await ws_manager.broadcast_to_trade(trade_id, {
                        "type": "status_update",
                        "status": "EXPIRED",
                        "message": "Trade expired - payment window exceeded",
                        "timestamp": now.isoformat(),
                    })
                    
                    logger.info(f"Trade {trade_id} auto-expired")
        except Exception as e:
            logger.error(f"Error in trade expiry check: {e}")
            await asyncio.sleep(10)  # Back off on error
        
        await asyncio.sleep(30)  # Check every 30 seconds

# ============ STARTUP ============

@app.on_event("startup")
async def startup():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username", unique=True)
    await db.offers.create_index("user_id")
    await db.offers.create_index("type")
    await db.trades.create_index("buyer_id")
    await db.trades.create_index("seller_id")
    await db.messages.create_index("trade_id")
    await db.notifications.create_index("user_id")
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.password_reset_tokens.create_index("token")
    
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@chainswap.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "username": "admin",
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "wallet_address": "",
            "role": "admin",
            "is_verified": True,
            "is_banned": False,
            "total_trades": 0,
            "completed_trades": 0,
            "completion_rate": 0.0,
            "avg_response_time": 0,
            "strikes": 0,
            "created_at": datetime.now(timezone.utc),
            "last_seen": datetime.now(timezone.utc),
        })
        logger.info("Admin user seeded")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info("Admin password updated")
    
    logger.info("ChainSwap API started")
    
    # Start background task for trade auto-expiry
    asyncio.create_task(check_expired_trades())

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000"), "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
