import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '', wallet_address: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (!agreed) { setError('Please accept the terms'); return; }
    setLoading(true);
    try {
      await register({ username: form.username, email: form.email, password: form.password, wallet_address: form.wallet_address });
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(e => e.msg).join(' ') : 'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    'Instant Registration — No KYC needed',
    'Escrow Protection — USDT locked during trade',
    '10+ Payment Methods — UPI, IMPS, Bank Transfer etc',
    'Trade Directly — No middleman',
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="blob-purple -left-40 top-20"></div>
      <div className="blob-blue -right-40 bottom-20"></div>
      
      <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center" data-testid="register-page">
        {/* Left - Features */}
        <div className="hidden lg:block">
          <h1 className="text-4xl font-black text-white mb-8 font-['Chivo']">Join ChainSwap</h1>
          <div className="space-y-4">
            {features.map(f => (
              <div key={f} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#10B981]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 text-[#10B981]" />
                </div>
                <p className="text-gray-300">{f}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right - Form */}
        <div className="bg-[#141414] rounded-2xl p-8 border border-white/5">
          <div className="text-center mb-6 lg:hidden">
            <Link to="/" className="inline-flex items-center gap-2 text-white font-black text-xl font-['Chivo']">
              <div className="w-8 h-8 rounded-lg bg-[#4F8EF7] flex items-center justify-center text-white text-sm font-bold">CS</div>
              ChainSwap
            </Link>
          </div>
          <h2 className="text-2xl font-bold text-white mb-6 font-['Chivo']">Create Account</h2>
          
          {error && <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm" data-testid="register-error">{error}</div>}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-[#A1A1AA] mb-1 block">Username</label>
              <input type="text" value={form.username} onChange={e => setForm({...form, username: e.target.value})} className="w-full px-4 py-3 bg-[#0A0A0A] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-[#4F8EF7] focus:outline-none" placeholder="Choose a username" required data-testid="register-username-input" />
            </div>
            <div>
              <label className="text-sm text-[#A1A1AA] mb-1 block">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-4 py-3 bg-[#0A0A0A] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-[#4F8EF7] focus:outline-none" placeholder="your@email.com" required data-testid="register-email-input" />
            </div>
            <div>
              <label className="text-sm text-[#A1A1AA] mb-1 block">Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full px-4 py-3 bg-[#0A0A0A] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-[#4F8EF7] focus:outline-none pr-10" placeholder="Min 6 characters" required data-testid="register-password-input" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm text-[#A1A1AA] mb-1 block">Confirm Password</label>
              <input type="password" value={form.confirmPassword} onChange={e => setForm({...form, confirmPassword: e.target.value})} className="w-full px-4 py-3 bg-[#0A0A0A] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-[#4F8EF7] focus:outline-none" placeholder="Re-enter password" required data-testid="register-confirm-password-input" />
            </div>
            <div>
              <label className="text-sm text-[#A1A1AA] mb-1 block">Wallet Address (optional)</label>
              <input type="text" value={form.wallet_address} onChange={e => setForm({...form, wallet_address: e.target.value})} className="w-full px-4 py-3 bg-[#0A0A0A] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-[#4F8EF7] focus:outline-none" placeholder="Your USDT wallet address" data-testid="register-wallet-input" />
            </div>

            {/* Warning */}
            <div className="p-3 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[#F59E0B] text-xs">
              ChainSwap uses client-side security. Keep your password safe — we cannot recover it.
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="w-4 h-4 rounded border-gray-600" data-testid="register-terms-checkbox" />
              <span className="text-sm text-[#A1A1AA]">I agree to the Terms & Conditions</span>
            </label>

            <button type="submit" disabled={loading} className="w-full py-3 bg-[#4F8EF7] text-white font-semibold rounded-full hover:bg-[#3B7BE8] transition-colors disabled:opacity-50" data-testid="register-submit-btn">
              {loading ? 'Creating account...' : 'Register'}
            </button>
          </form>
          
          <p className="text-center text-[#A1A1AA] text-sm mt-6">
            Already have account? <Link to="/login" className="text-[#4F8EF7] hover:underline" data-testid="register-login-link">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
