import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Bell, Menu, X, ChevronDown, LogOut, User, LayoutDashboard, Shield } from 'lucide-react';
import { api } from '../contexts/AuthContext';

export default function Navbar({ dark = false }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  React.useEffect(() => {
    if (user) {
      api.get('/notifications/unread-count').then(r => setUnreadCount(r.data.count)).catch(() => {});
    }
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const bgClass = dark ? 'bg-black/60 backdrop-blur-xl border-b border-white/5' : 'bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm';
  const textClass = dark ? 'text-white' : 'text-gray-900';
  const mutedClass = dark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900';

  return (
    <nav className={`sticky top-0 z-50 ${bgClass}`} data-testid="navbar">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className={`flex items-center gap-2 font-black text-xl ${textClass}`} data-testid="nav-logo">
            <div className="w-8 h-8 rounded-lg bg-[#4F8EF7] flex items-center justify-center text-white text-sm font-bold">CS</div>
            <span className="font-['Chivo']">ChainSwap</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/buy" className={`text-sm font-medium ${mutedClass} transition-colors`} data-testid="nav-buy">Buy USDT</Link>
            <Link to="/sell" className={`text-sm font-medium ${mutedClass} transition-colors`} data-testid="nav-sell">Sell USDT</Link>
            <Link to="/create-offer" className={`text-sm font-medium ${mutedClass} transition-colors`} data-testid="nav-create-offer">Create Offer</Link>
            {user && <Link to="/dashboard" className={`text-sm font-medium ${mutedClass} transition-colors`} data-testid="nav-dashboard">Dashboard</Link>}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {/* Notifications */}
                <Link to="/dashboard" className="relative p-2" data-testid="nav-notifications">
                  <Bell className={`w-5 h-5 ${dark ? 'text-gray-400' : 'text-gray-600'}`} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unreadCount}</span>
                  )}
                </Link>
                {/* User menu */}
                <div className="relative">
                  <button onClick={() => setUserMenuOpen(!userMenuOpen)} className={`flex items-center gap-2 text-sm font-medium ${textClass}`} data-testid="nav-user-menu">
                    <div className="w-8 h-8 rounded-full bg-[#4F8EF7] flex items-center justify-center text-white text-xs font-bold">
                      {user.username?.charAt(0).toUpperCase()}
                    </div>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50" data-testid="user-dropdown">
                      <Link to="/dashboard" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setUserMenuOpen(false)}>
                        <LayoutDashboard className="w-4 h-4" /> Dashboard
                      </Link>
                      <Link to={`/user/${user.username}`} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setUserMenuOpen(false)}>
                        <User className="w-4 h-4" /> Profile
                      </Link>
                      {user.role === 'admin' && (
                        <Link to="/admin" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setUserMenuOpen(false)}>
                          <Shield className="w-4 h-4" /> Admin Panel
                        </Link>
                      )}
                      <hr className="my-1" />
                      <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full" data-testid="nav-logout">
                        <LogOut className="w-4 h-4" /> Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login" className={`text-sm font-medium ${mutedClass}`} data-testid="nav-login">Login</Link>
                <Link to="/register" className="px-5 py-2 bg-[#4F8EF7] text-white text-sm font-semibold rounded-full hover:bg-[#3B7BE8] transition-colors" data-testid="nav-register">Register</Link>
              </div>
            )}
            {/* Mobile menu toggle */}
            <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className={`w-5 h-5 ${textClass}`} /> : <Menu className={`w-5 h-5 ${textClass}`} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className={`md:hidden px-4 pb-4 ${dark ? 'bg-black/90' : 'bg-white'}`}>
          <Link to="/buy" className={`block py-2 text-sm ${mutedClass}`} onClick={() => setMenuOpen(false)}>Buy USDT</Link>
          <Link to="/sell" className={`block py-2 text-sm ${mutedClass}`} onClick={() => setMenuOpen(false)}>Sell USDT</Link>
          <Link to="/create-offer" className={`block py-2 text-sm ${mutedClass}`} onClick={() => setMenuOpen(false)}>Create Offer</Link>
          {user && <Link to="/dashboard" className={`block py-2 text-sm ${mutedClass}`} onClick={() => setMenuOpen(false)}>Dashboard</Link>}
        </div>
      )}
    </nav>
  );
}
