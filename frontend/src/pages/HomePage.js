import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Shield, ArrowRightLeft, Headphones, TrendingUp, Award, CheckCircle } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export default function HomePage() {
  const [stats, setStats] = useState({ total_offers: 0, total_volume_inr: 0, payment_methods: 6 });
  const [topTraders, setTopTraders] = useState([]);

  useEffect(() => {
    axios.get(`${API}/api/stats`).then(r => setStats(r.data)).catch(() => {});
    axios.get(`${API}/api/top-traders?days=90&limit=5`).then(r => setTopTraders(r.data)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white overflow-hidden">
      <Navbar dark />
      
      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center justify-center px-4" data-testid="hero-section">
        {/* Blobs */}
        <div className="blob-purple -left-40 top-20"></div>
        <div className="blob-blue -right-40 top-40"></div>
        
        <div className="relative z-10 text-center max-w-4xl mx-auto animate-fadeIn">
          <h1 className="font-['Chivo'] text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight mb-6" data-testid="hero-heading">
            <span className="text-[#4F8EF7]">Buy</span> & <span className="text-[#10B981]">Sell</span> USDT
          </h1>
          <p className="text-lg text-[#A1A1AA] mb-10 max-w-2xl mx-auto">
            Trade USDT peer-to-peer with 10+ payment methods. Fast, secure, and non-custodial.
          </p>

          {/* Trust Icons */}
          <div className="flex flex-wrap justify-center gap-8 mb-10">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <ArrowRightLeft className="w-5 h-5 text-[#4F8EF7]" />
              <span>Trade P2P</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Shield className="w-5 h-5 text-[#4F8EF7]" />
              <span>Non Custodial</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Headphones className="w-5 h-5 text-[#4F8EF7]" />
              <span>24x7 Support</span>
            </div>
          </div>

          <Link to="/buy" className="inline-block px-10 py-4 bg-[#4F8EF7] text-white font-semibold text-lg rounded-full hover:bg-[#3B7BE8] transition-all hover:scale-105 animate-pulse-glow" data-testid="start-trading-btn">
            Start Trading
          </Link>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="relative z-10 py-16 border-t border-white/5" data-testid="stats-section">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center px-4">
          <div>
            <p className="text-4xl font-black text-white font-['Chivo']">{stats.total_offers}+</p>
            <p className="text-sm text-[#A1A1AA] uppercase tracking-widest mt-2">Trade Offers</p>
          </div>
          <div>
            <p className="text-4xl font-black text-[#4F8EF7] font-['Chivo']">₹{(stats.total_volume_inr / 1000000).toFixed(1)}M+</p>
            <p className="text-sm text-[#A1A1AA] uppercase tracking-widest mt-2">In Trades</p>
          </div>
          <div>
            <p className="text-4xl font-black text-white font-['Chivo']">{stats.payment_methods}+</p>
            <p className="text-sm text-[#A1A1AA] uppercase tracking-widest mt-2">Payment Methods</p>
          </div>
        </div>
      </section>

      {/* USDT Row */}
      <section className="relative z-10 py-12 px-4" data-testid="usdt-section">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-['Chivo'] text-3xl font-bold mb-8">Trade USDT</h2>
          <div className="bg-[#141414] rounded-2xl p-6 border border-white/5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#26A17B] flex items-center justify-center text-white font-bold text-lg">₮</div>
              <div>
                <p className="font-semibold text-white">Tether</p>
                <p className="text-sm text-[#A1A1AA]">USDT</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#10B981]" />
              <span className="text-[#10B981] text-sm">Stable</span>
            </div>
            <div className="flex gap-3">
              <Link to="/buy" className="px-6 py-2.5 bg-[#4F8EF7] text-white font-semibold rounded-full hover:bg-[#3B7BE8] transition-colors" data-testid="hero-buy-btn">Buy</Link>
              <Link to="/sell" className="px-6 py-2.5 border border-white/20 text-white font-semibold rounded-full hover:bg-white/5 transition-colors" data-testid="hero-sell-btn">Sell</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Networks */}
      <section className="relative z-10 py-16 px-4" data-testid="networks-section">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-['Chivo'] text-3xl font-bold mb-8">Supported Networks</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: 'Ethereum', short: 'ERC20', color: '#627EEA', desc: 'Trade USDT on Ethereum network with full security' },
              { name: 'Binance Smart Chain', short: 'BEP20', color: '#F3BA2F', desc: 'Fast and low-cost trades on BSC network' },
              { name: 'Tron', short: 'TRC20', color: '#FF0013', desc: 'Zero-fee USDT transfers on Tron network' },
            ].map(net => (
              <div key={net.short} className="bg-[#141414] rounded-2xl p-6 border border-white/5 hover:-translate-y-1 transition-transform">
                <div className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center" style={{ backgroundColor: net.color + '20' }}>
                  <span className="font-bold text-sm" style={{ color: net.color }}>{net.short}</span>
                </div>
                <h3 className="font-semibold text-white mb-2">{net.name}</h3>
                <p className="text-sm text-[#A1A1AA]">{net.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="relative z-10 py-16 px-4 border-t border-white/5" data-testid="how-it-works">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="font-['Chivo'] text-3xl font-bold mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: '1', title: 'Register', desc: 'Create account in seconds' },
              { step: '2', title: 'Find Offer', desc: 'Browse buy/sell offers' },
              { step: '3', title: 'Trade', desc: 'Complete payment securely' },
              { step: '4', title: 'Receive', desc: 'Get USDT in your wallet' },
            ].map(s => (
              <div key={s.step}>
                <div className="w-12 h-12 rounded-full bg-[#4F8EF7] text-white font-bold flex items-center justify-center mx-auto mb-4">{s.step}</div>
                <h4 className="font-semibold text-white mb-1">{s.title}</h4>
                <p className="text-sm text-[#A1A1AA]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Top Traders Leaderboard */}
      {topTraders.length > 0 && (
        <section className="relative z-10 py-16 px-4 border-t border-white/5" data-testid="top-traders-section">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-['Chivo'] text-3xl font-bold mb-3">Top Traders</h2>
              <p className="text-[#A1A1AA]">Our most trusted community members</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {topTraders.map(trader => (
                <Link to={`/user/${trader.username}`} key={trader.rank} className="bg-[#141414] rounded-2xl p-5 border border-white/5 hover:border-[#4F8EF7]/30 hover:-translate-y-1 transition-all group" data-testid={`top-trader-${trader.rank}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${trader.rank === 1 ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : trader.rank === 2 ? 'bg-[#A1A1AA]/20 text-[#A1A1AA]' : trader.rank === 3 ? 'bg-[#CD7F32]/20 text-[#CD7F32]' : 'bg-[#4F8EF7]/10 text-[#4F8EF7]'}`}>
                      #{trader.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="font-semibold text-white text-sm truncate group-hover:text-[#4F8EF7] transition-colors">{trader.username}</p>
                        {trader.is_verified_trader && (
                          <CheckCircle className="w-3.5 h-3.5 text-[#4F8EF7] flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#A1A1AA]">Trades</span>
                      <span className="text-white font-medium">{trader.completed_trades}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#A1A1AA]">Rate</span>
                      <span className={`font-medium ${trader.completion_rate >= 90 ? 'text-[#10B981]' : 'text-[#F59E0B]'}`}>{trader.completion_rate}%</span>
                    </div>
                    {trader.volume_usdt > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-[#A1A1AA]">Volume</span>
                        <span className="text-[#4F8EF7] font-medium">{trader.volume_usdt.toFixed(0)} USDT</span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="relative z-10 py-8 px-4 border-t border-white/5 text-center text-[#A1A1AA] text-sm">
        <p>© 2026 ChainSwap. P2P USDT Trading Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}
