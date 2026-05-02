# ChainSwap - P2P USDT Trading Platform

## Original Problem Statement
Build a fully functional P2P USDT trading platform called "ChainSwap" with real user authentication, complete trade flow, and admin dashboard. UI like LocalCoinSwap.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) + MongoDB via Motor
- **Auth**: JWT (httpOnly cookies + Bearer header) + bcrypt
- **Real-time**: Polling-based chat (5s interval)
- **Storage**: Local file uploads for payment proofs

## User Personas
1. **Buyer** - Wants to buy USDT using INR (UPI/IMPS/Bank Transfer)
2. **Seller** - Wants to sell USDT for INR
3. **Admin** - Manages disputes, bans users, oversees platform

## Core Requirements
- User registration/login with JWT auth
- Create buy/sell offers with pricing, limits, payment methods
- Trade initiation from offers (amount, payment method)
- Trade lifecycle: INITIATED → PAYMENT_SENT → COMPLETED/DISPUTED
- Real-time chat between buyer/seller
- Admin dashboard with dispute resolution
- Notifications system
- User profiles with reviews

## What's Been Implemented (2026-05-02)
- Full auth system (register, login, logout, me, refresh)
- Admin seeded on startup (first user = admin)
- Offers CRUD (create, list, filter, toggle, delete)
- Trade flow (initiate, update status, upload payment proof)
- Messages/chat (send, list, system messages)
- Reviews system
- Notifications (in-app, mark read, unread count)
- User profiles (public profile, reviews)
- Admin dashboard (stats, users, trades, disputes, offers management)
- Dispute resolution with strike system (3 strikes = auto-ban)
- Dark homepage with purple/blue blobs
- Light inner pages (Buy, Sell, Trade, Dashboard)
- Dark admin panel

## Testing Results
- Backend: 26/26 tests passed (100%)
- Frontend: All user flows verified

## P0 (Done)
- [x] Auth (register/login/logout)
- [x] Offers (create/list/filter)
- [x] Trade flow (initiate/status updates)
- [x] Chat (polling-based)
- [x] Admin (disputes/ban/stats)
- [x] Dark homepage + light inner pages

## P1 (Next)
- [ ] WebSocket for true real-time chat
- [ ] Password reset (forgot password flow)
- [ ] Trade expiry (auto-expire after payment window)
- [ ] CSV export for admin reports
- [ ] Email notifications (requires SMTP setup)

## P2 (Future)
- [ ] KYC verification flow
- [ ] Two-factor authentication
- [ ] Platform fee system
- [ ] Maintenance mode
- [ ] Mobile app (React Native)
