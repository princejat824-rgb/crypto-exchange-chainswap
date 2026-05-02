import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/api/auth/forgot-password`, { email });
      setSent(true);
      toast.success('Reset link sent! Check your email.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Something went wrong');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="blob-purple -left-40 top-20"></div>
      <div className="blob-blue -right-40 bottom-20"></div>
      
      <div className="relative z-10 w-full max-w-md" data-testid="forgot-password-page">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-white font-black text-2xl font-['Chivo']">
            <div className="w-8 h-8 rounded-lg bg-[#4F8EF7] flex items-center justify-center text-white text-sm font-bold">CS</div>
            ChainSwap
          </Link>
        </div>

        <div className="bg-[#141414] rounded-2xl p-8 border border-white/5">
          <h2 className="text-2xl font-bold text-white mb-2 font-['Chivo']">Forgot Password</h2>
          <p className="text-[#A1A1AA] text-sm mb-6">Enter your email and we'll send you a reset link.</p>
          
          {sent ? (
            <div className="text-center" data-testid="reset-sent-confirmation">
              <div className="w-16 h-16 rounded-full bg-[#10B981]/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="text-white font-medium mb-2">Reset Link Sent!</p>
              <p className="text-[#A1A1AA] text-sm mb-4">Check your email for the password reset link. If you don't see it, check your spam folder.</p>
              <Link to="/login" className="text-[#4F8EF7] text-sm hover:underline">Back to Login</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-[#A1A1AA] mb-1 block">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0A0A0A] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-[#4F8EF7] focus:outline-none transition-colors"
                  placeholder="your@email.com"
                  required
                  data-testid="forgot-email-input"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#4F8EF7] text-white font-semibold rounded-full hover:bg-[#3B7BE8] transition-colors disabled:opacity-50"
                data-testid="forgot-submit-btn"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}
          
          <p className="text-center text-[#A1A1AA] text-sm mt-6">
            Remember your password? <Link to="/login" className="text-[#4F8EF7] hover:underline">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
