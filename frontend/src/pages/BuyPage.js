import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { User, Star, Clock, X, CheckCircle } from 'lucide-react';
import { useAuth, api } from '../contexts/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export default function BuyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentFilter, setPaymentFilter] = useState('');
  const [networkFilter, setNetworkFilter] = useState('');
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [tradeAmount, setTradeAmount] = useState('');
  const [tradePayment, setTradePayment] = useState('');
  const [initiating, setInitiating] = useState(false);

  useEffect(() => {
    fetchOffers();
  }, [paymentFilter, networkFilter]);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      let url = `${API}/api/offers?type=sell`;
      if (paymentFilter) url += `&payment_method=${paymentFilter}`;
      if (networkFilter) url += `&network=${networkFilter}`;
      const res = await axios.get(url);
      setOffers(res.data);
    } catch {} finally { setLoading(false); }
  };

  const initiateTrade = async () => {
    if (!user) { navigate('/login'); return; }
    if (!tradeAmount || parseFloat(tradeAmount) <= 0) { toast.error('Enter valid amount'); return; }
    if (!tradePayment) { toast.error('Select payment method'); return; }
    
    const amountUsdt = parseFloat(tradeAmount);
    if (amountUsdt * selectedOffer.price_inr < selectedOffer.min_limit_inr) { toast.error(`Minimum trade is ₹${selectedOffer.min_limit_inr}`); return; }
    if (amountUsdt * selectedOffer.price_inr > selectedOffer.max_limit_inr) { toast.error(`Maximum trade is ₹${selectedOffer.max_limit_inr}`); return; }
    if (amountUsdt > selectedOffer.available_usdt) { toast.error('Amount exceeds available USDT'); return; }

    setInitiating(true);
    try {
      const res = await api.post('/trades', { offer_id: selectedOffer.id, amount_usdt: amountUsdt, payment_method: tradePayment });
      toast.success('Trade initiated!');
      navigate(`/trade/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to initiate trade');
    } finally { setInitiating(false); }
  };

  const paymentMethods = ['UPI', 'IMPS', 'Bank Transfer', 'Paytm', 'PhonePe', 'NEFT'];
  const networks = ['TRC20', 'ERC20', 'BEP20'];

  return (
    <div className="min-h-screen bg-[#F0F2F5]">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8" data-testid="buy-page">
        <h1 className="font-['Chivo'] text-3xl font-bold text-gray-900 mb-2">Buy USDT</h1>
        <p className="text-gray-500 mb-6">Find sellers and buy USDT with your preferred payment method</p>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6" data-testid="buy-filters">
          <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:border-[#4F8EF7] focus:outline-none" data-testid="payment-filter">
            <option value="">All Payment Methods</option>
            {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={networkFilter} onChange={e => setNetworkFilter(e.target.value)} className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:border-[#4F8EF7] focus:outline-none" data-testid="network-filter">
            <option value="">All Networks</option>
            {networks.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* Offers List */}
        <div className="space-y-4" data-testid="offers-list">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading offers...</div>
          ) : offers.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl">
              <p className="text-gray-500 mb-4">No active offers found</p>
              <Link to="/create-offer" className="text-[#4F8EF7] font-semibold hover:underline">Be the first to create one</Link>
            </div>
          ) : (
            offers.map(offer => (
              <div key={offer.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:-translate-y-0.5 transition-transform" data-testid={`offer-card-${offer.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#4F8EF7]/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-[#4F8EF7]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link to={`/user/${offer.username}`} className="font-semibold text-gray-900 hover:text-[#4F8EF7]">{offer.username}</Link>
                        {offer.user_stats?.is_verified_trader && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[#4F8EF7]/10 text-[#4F8EF7] rounded-full text-[10px] font-semibold" title="Verified Trader - 50+ completed trades">
                            <CheckCircle className="w-2.5 h-2.5" /> Verified
                          </span>
                        )}
                        <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span className="flex items-center gap-1"><Star className="w-3 h-3" /> {offer.user_stats?.completion_rate || 0}%</span>
                        <span>{offer.user_stats?.completed_trades || 0} trades</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {offer.payment_methods?.map(m => (
                      <span key={m} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{m}</span>
                    ))}
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-bold text-[#4F8EF7] font-['Chivo']">₹{offer.price_inr}</p>
                    <p className="text-xs text-gray-500">per USDT</p>
                  </div>

                  <div className="text-right text-sm text-gray-600">
                    <p>Limits: ₹{offer.min_limit_inr} - ₹{offer.max_limit_inr}</p>
                    <p className="flex items-center gap-1 justify-end"><Clock className="w-3 h-3" /> {offer.available_usdt} USDT available</p>
                  </div>

                  <button onClick={() => { setSelectedOffer(offer); setTradePayment(offer.payment_methods?.[0] || ''); }} className="px-6 py-2.5 bg-[#4F8EF7] text-white font-semibold rounded-full hover:bg-[#3B7BE8] transition-colors" data-testid={`buy-btn-${offer.id}`}>
                    Buy
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Trade Initiation Modal */}
      {selectedOffer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="trade-modal">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-fadeIn">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-['Chivo'] text-xl font-bold text-gray-900">Buy USDT from {selectedOffer.username}</h3>
              <button onClick={() => setSelectedOffer(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-xl text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Rate</span><span className="font-medium">₹{selectedOffer.price_inr}/USDT</span></div>
                <div className="flex justify-between mt-1"><span className="text-gray-500">Limits</span><span>₹{selectedOffer.min_limit_inr} - ₹{selectedOffer.max_limit_inr}</span></div>
                <div className="flex justify-between mt-1"><span className="text-gray-500">Available</span><span>{selectedOffer.available_usdt} USDT</span></div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Amount (USDT)</label>
                <input type="number" step="0.01" value={tradeAmount} onChange={e => setTradeAmount(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#4F8EF7] focus:outline-none" placeholder="Enter USDT amount" data-testid="trade-amount-input" />
                {tradeAmount && <p className="text-sm text-gray-500 mt-1">You pay: ₹{(parseFloat(tradeAmount || 0) * selectedOffer.price_inr).toFixed(2)}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Payment Method</label>
                <select value={tradePayment} onChange={e => setTradePayment(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#4F8EF7] focus:outline-none" data-testid="trade-payment-select">
                  {selectedOffer.payment_methods?.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <button onClick={initiateTrade} disabled={initiating} className="w-full py-3 bg-[#4F8EF7] text-white font-semibold rounded-full hover:bg-[#3B7BE8] transition-colors disabled:opacity-50" data-testid="initiate-trade-btn">
                {initiating ? 'Initiating...' : 'Start Trade'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
