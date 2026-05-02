import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { api } from '../contexts/AuthContext';
import { toast } from 'sonner';

export default function CreateOfferPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    type: 'sell',
    network: 'TRC20',
    price_inr: '',
    available_usdt: '',
    min_limit_inr: '',
    max_limit_inr: '',
    payment_methods: [],
    payment_window_mins: 30,
    trade_terms: '',
  });

  const paymentOptions = ['UPI', 'IMPS', 'Bank Transfer', 'Paytm', 'PhonePe', 'NEFT'];

  const togglePayment = (method) => {
    setForm(prev => ({
      ...prev,
      payment_methods: prev.payment_methods.includes(method)
        ? prev.payment_methods.filter(m => m !== method)
        : [...prev.payment_methods, method]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.payment_methods.length === 0) { toast.error('Select at least one payment method'); return; }
    setLoading(true);
    try {
      await api.post('/offers', {
        ...form,
        price_inr: parseFloat(form.price_inr),
        available_usdt: parseFloat(form.available_usdt),
        min_limit_inr: parseFloat(form.min_limit_inr),
        max_limit_inr: parseFloat(form.max_limit_inr),
      });
      toast.success('Offer created successfully!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create offer');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5]">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8" data-testid="create-offer-page">
        <h1 className="font-['Chivo'] text-3xl font-bold text-gray-900 mb-2">Create Offer</h1>
        <p className="text-gray-500 mb-8">Set your terms and start trading</p>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
          {/* Type Toggle */}
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-700 mb-2 block">I want to</label>
            <div className="flex gap-2" data-testid="offer-type-toggle">
              <button type="button" onClick={() => setForm({...form, type: 'sell'})} className={`px-6 py-2 rounded-full font-medium text-sm transition-colors ${form.type === 'sell' ? 'bg-[#4F8EF7] text-white' : 'bg-gray-100 text-gray-600'}`} data-testid="offer-type-sell">Sell USDT</button>
              <button type="button" onClick={() => setForm({...form, type: 'buy'})} className={`px-6 py-2 rounded-full font-medium text-sm transition-colors ${form.type === 'buy' ? 'bg-[#4F8EF7] text-white' : 'bg-gray-100 text-gray-600'}`} data-testid="offer-type-buy">Buy USDT</button>
            </div>
          </div>

          {/* Network */}
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Network</label>
            <div className="flex gap-2" data-testid="offer-network-select">
              {['TRC20', 'ERC20', 'BEP20'].map(net => (
                <button key={net} type="button" onClick={() => setForm({...form, network: net})} className={`px-4 py-2 rounded-full font-medium text-sm transition-colors ${form.network === net ? 'bg-[#4F8EF7] text-white' : 'bg-gray-100 text-gray-600'}`}>{net}</button>
              ))}
            </div>
          </div>

          {/* Price */}
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Price per USDT (INR)</label>
            <input type="number" step="0.01" value={form.price_inr} onChange={e => setForm({...form, price_inr: e.target.value})} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#4F8EF7] focus:outline-none" placeholder="e.g. 88.50" required data-testid="offer-price-input" />
          </div>

          {/* Available USDT */}
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Available USDT Amount</label>
            <input type="number" step="0.01" value={form.available_usdt} onChange={e => setForm({...form, available_usdt: e.target.value})} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#4F8EF7] focus:outline-none" placeholder="e.g. 1000" required data-testid="offer-amount-input" />
          </div>

          {/* Limits */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Min Limit (INR)</label>
              <input type="number" value={form.min_limit_inr} onChange={e => setForm({...form, min_limit_inr: e.target.value})} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#4F8EF7] focus:outline-none" placeholder="500" required data-testid="offer-min-limit" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Max Limit (INR)</label>
              <input type="number" value={form.max_limit_inr} onChange={e => setForm({...form, max_limit_inr: e.target.value})} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#4F8EF7] focus:outline-none" placeholder="50000" required data-testid="offer-max-limit" />
            </div>
          </div>

          {/* Payment Methods */}
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Payment Methods</label>
            <div className="flex flex-wrap gap-2" data-testid="offer-payment-methods">
              {paymentOptions.map(m => (
                <button key={m} type="button" onClick={() => togglePayment(m)} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${form.payment_methods.includes(m) ? 'bg-[#4F8EF7] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} data-testid={`payment-method-${m.replace(/\s+/g, '-').toLowerCase()}`}>{m}</button>
              ))}
            </div>
          </div>

          {/* Payment Window */}
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Payment Window</label>
            <div className="flex gap-2">
              {[15, 30, 45, 60].map(mins => (
                <button key={mins} type="button" onClick={() => setForm({...form, payment_window_mins: mins})} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${form.payment_window_mins === mins ? 'bg-[#4F8EF7] text-white' : 'bg-gray-100 text-gray-600'}`}>{mins} min</button>
              ))}
            </div>
          </div>

          {/* Trade Terms */}
          <div className="mb-8">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Trade Terms (optional)</label>
            <textarea value={form.trade_terms} onChange={e => setForm({...form, trade_terms: e.target.value})} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#4F8EF7] focus:outline-none h-24 resize-none" placeholder="Any specific instructions for traders..." data-testid="offer-terms-input" />
          </div>

          <button type="submit" disabled={loading} className="w-full py-3 bg-[#4F8EF7] text-white font-semibold rounded-full hover:bg-[#3B7BE8] transition-colors disabled:opacity-50" data-testid="create-offer-submit-btn">
            {loading ? 'Creating...' : 'Create Offer'}
          </button>
        </form>
      </div>
    </div>
  );
}
