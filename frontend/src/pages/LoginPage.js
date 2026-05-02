import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      toast.success('Login successful!');
      if (data.role === 'admin') navigate('/admin');
      else navigate('/dashboard');
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(e => e.msg).join(' ') : 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="blob-purple -left-40 top-20"></div>
      <div className="blob-blue -right-40 bottom-20"></div>
      
      <div className="relative z-10 w-full max-w-md" data-testid="login-page">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-white font-black text-2xl font-['Chivo']">
            <div className="w-8 h-8 rounded-lg bg-[#4F8EF7] flex items-center justify-center text-white text-sm font-bold">CS</div>
            ChainSwap
          </Link>
        </div>

        <div className="bg-[#141414] rounded-2xl p-8 border border-white/5">
          <h2 className="text-2xl font-bold text-white mb-6 font-['Chivo']">Welcome Back</h2>
          
          {error && <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm" data-testid="login-error">{error}</div>}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-[#A1A1AA] mb-1 block">Email or Username</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[#0A0A0A] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-[#4F8EF7] focus:outline-none transition-colors"
                placeholder="Enter email or username"
                required
                data-testid="login-email-input"
              />
            </div>
            <div>
              <label className="text-sm text-[#A1A1AA] mb-1 block">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0A0A0A] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-[#4F8EF7] focus:outline-none transition-colors pr-10"
                  placeholder="Enter password"
                  required
                  data-testid="login-password-input"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#4F8EF7] text-white font-semibold rounded-full hover:bg-[#3B7BE8] transition-colors disabled:opacity-50"
              data-testid="login-submit-btn"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          
          <p className="text-center text-[#A1A1AA] text-sm mt-6">
            <Link to="/forgot-password" className="text-[#4F8EF7] hover:underline" data-testid="forgot-password-link">Forgot password?</Link>
            <span className="mx-2">|</span>
            New here? <Link to="/register" className="text-[#4F8EF7] hover:underline" data-testid="login-register-link">Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
