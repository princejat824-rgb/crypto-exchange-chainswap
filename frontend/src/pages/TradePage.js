import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth, api } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Send, Upload, AlertTriangle, CheckCircle, Clock, MessageCircle } from 'lucide-react';

export default function TradePage() {
  const { tradeId } = useParams();
  const { user } = useAuth();
  const [trade, setTrade] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    fetchTrade();
    fetchMessages();
    // Poll for updates every 5s
    pollRef.current = setInterval(() => { fetchTrade(); fetchMessages(); }, 5000);
    return () => clearInterval(pollRef.current);
  }, [tradeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!trade) return;
    if (trade.status !== 'INITIATED' && trade.status !== 'PAYMENT_SENT') return;
    const interval = setInterval(() => {
      const created = new Date(trade.created_at);
      const deadline = new Date(created.getTime() + (trade.payment_window_mins || 30) * 60000);
      const diff = deadline - new Date();
      if (diff <= 0) { setTimeLeft('EXPIRED'); clearInterval(interval); }
      else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [trade]);

  const fetchTrade = async () => {
    try {
      const res = await api.get(`/trades/${tradeId}`);
      setTrade(res.data);
    } catch { } finally { setLoading(false); }
  };

  const fetchMessages = async () => {
    try {
      const res = await api.get(`/trades/${tradeId}/messages`);
      setMessages(res.data);
    } catch { }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      await api.post(`/trades/${tradeId}/messages`, { message: newMessage });
      setNewMessage('');
      fetchMessages();
    } catch { toast.error('Failed to send message'); }
  };

  const updateStatus = async (status, disputeReason) => {
    try {
      await api.patch(`/trades/${tradeId}/status`, { status, dispute_reason: disputeReason });
      toast.success(`Trade status updated to ${status}`);
      fetchTrade();
      fetchMessages();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update status'); }
  };

  const handlePaymentProof = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post(`/trades/${tradeId}/upload-proof`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Payment proof uploaded');
      fetchTrade();
    } catch { toast.error('Upload failed'); }
  };

  const statusColors = {
    INITIATED: 'bg-blue-100 text-blue-700',
    PAYMENT_SENT: 'bg-yellow-100 text-yellow-700',
    PAYMENT_CONFIRMED: 'bg-green-100 text-green-700',
    COMPLETED: 'bg-green-100 text-green-700',
    DISPUTED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-gray-100 text-gray-700',
    EXPIRED: 'bg-gray-100 text-gray-700',
  };

  if (loading) return <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-[#4F8EF7] border-t-transparent rounded-full"></div></div>;
  if (!trade) return <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center text-gray-500">Trade not found</div>;

  return (
    <div className="min-h-screen bg-[#F0F2F5]">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-6" data-testid="trade-page">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel - Trade Details */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-['Chivo'] text-xl font-bold text-gray-900" data-testid="trade-title">
                  {trade.is_buyer ? `Buy USDT from ${trade.seller_info?.username}` : `Sell USDT to ${trade.buyer_info?.username}`}
                </h2>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[trade.status] || 'bg-gray-100'}`} data-testid="trade-status-badge">{trade.status}</span>
              </div>

              {/* Timer */}
              {timeLeft && trade.status !== 'COMPLETED' && trade.status !== 'CANCELLED' && (
                <div className={`flex items-center gap-2 mb-4 p-3 rounded-xl ${timeLeft === 'EXPIRED' ? 'bg-red-50 text-red-600' : parseInt(timeLeft) < 5 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`} data-testid="trade-timer">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">{timeLeft === 'EXPIRED' ? 'Payment window expired' : `Time remaining: ${timeLeft}`}</span>
                </div>
              )}

              {/* Trade Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500">Amount</p>
                  <p className="text-lg font-bold text-gray-900">{trade.amount_usdt} USDT</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500">Total INR</p>
                  <p className="text-lg font-bold text-gray-900">₹{trade.amount_inr?.toFixed(2)}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500">Rate</p>
                  <p className="text-sm font-medium text-gray-700">1 USDT = ₹{trade.price_inr}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500">Payment Method</p>
                  <p className="text-sm font-medium text-gray-700">{trade.payment_method}</p>
                </div>
              </div>

              {/* Trade Terms */}
              {trade.trade_terms && (
                <div className="p-4 bg-gray-50 rounded-xl mb-6">
                  <p className="text-xs text-gray-500 mb-1">Trade Terms</p>
                  <p className="text-sm text-gray-700">{trade.trade_terms}</p>
                </div>
              )}

              {/* Action Buttons based on status */}
              <div className="space-y-3" data-testid="trade-actions">
                {trade.status === 'INITIATED' && trade.is_buyer && (
                  <>
                    <label className="block w-full cursor-pointer">
                      <input type="file" accept="image/*" onChange={handlePaymentProof} className="hidden" />
                      <div className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-[#4F8EF7] hover:text-[#4F8EF7] transition-colors">
                        <Upload className="w-4 h-4" /> Upload Payment Proof
                      </div>
                    </label>
                    <button onClick={() => updateStatus('PAYMENT_SENT')} className="w-full py-3 bg-[#4F8EF7] text-white font-semibold rounded-full hover:bg-[#3B7BE8] transition-colors" data-testid="payment-sent-btn">
                      I have sent the payment
                    </button>
                  </>
                )}
                {trade.status === 'PAYMENT_SENT' && trade.is_buyer && (
                  <div className="p-4 bg-yellow-50 rounded-xl text-yellow-700 text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Waiting for seller to confirm payment...
                  </div>
                )}
                {trade.status === 'PAYMENT_SENT' && trade.is_seller && (
                  <div className="flex gap-3">
                    <button onClick={() => updateStatus('COMPLETED')} className="flex-1 py-3 bg-[#10B981] text-white font-semibold rounded-full hover:bg-[#059669] transition-colors" data-testid="confirm-payment-btn">
                      <CheckCircle className="w-4 h-4 inline mr-1" /> Release USDT
                    </button>
                    <button onClick={() => { const reason = prompt('Reason for dispute:'); if (reason) updateStatus('DISPUTED', reason); }} className="flex-1 py-3 bg-red-500 text-white font-semibold rounded-full hover:bg-red-600 transition-colors" data-testid="dispute-btn">
                      <AlertTriangle className="w-4 h-4 inline mr-1" /> Dispute
                    </button>
                  </div>
                )}
                {trade.status === 'COMPLETED' && (
                  <div className="p-4 bg-green-50 rounded-xl text-green-700 text-sm flex items-center gap-2" data-testid="trade-completed-msg">
                    <CheckCircle className="w-5 h-5" /> Trade Completed Successfully!
                  </div>
                )}
                {trade.status === 'DISPUTED' && (
                  <div className="p-4 bg-red-50 rounded-xl text-red-700 text-sm flex items-center gap-2" data-testid="trade-disputed-msg">
                    <AlertTriangle className="w-5 h-5" /> Trade under review by admin. Reason: {trade.dispute_reason}
                  </div>
                )}
                {/* Dispute button for both parties when payment is sent */}
                {trade.status === 'PAYMENT_SENT' && trade.is_buyer && (
                  <button onClick={() => { const reason = prompt('Reason for dispute:'); if (reason) updateStatus('DISPUTED', reason); }} className="w-full py-2 border border-red-300 text-red-500 font-medium rounded-full hover:bg-red-50 transition-colors text-sm">
                    Open Dispute
                  </button>
                )}
              </div>
            </div>

            {/* Trade Details Panel */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-3">Trade Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Trade ID</span><span className="font-mono text-gray-700">{trade.id?.slice(0, 12)}...</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Network</span><span className="text-gray-700">{trade.network}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Created</span><span className="text-gray-700">{new Date(trade.created_at).toLocaleString()}</span></div>
                {trade.payment_proof_url && (
                  <div className="flex justify-between"><span className="text-gray-500">Payment Proof</span><a href={`${process.env.REACT_APP_BACKEND_URL}${trade.payment_proof_url}`} target="_blank" rel="noreferrer" className="text-[#4F8EF7] hover:underline">View</a></div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Chat */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-120px)] sticky top-20" data-testid="trade-chat">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-[#4F8EF7]" />
                <h3 className="font-semibold text-gray-900">Trade Chat</h3>
              </div>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(msg => (
                  <div key={msg.id} className={`${msg.sender_id === 'system' ? 'text-center' : msg.sender_id === user?.id ? 'text-right' : 'text-left'}`}>
                    {msg.sender_id === 'system' ? (
                      <p className="text-xs text-gray-400 italic py-1">{msg.message}</p>
                    ) : (
                      <div className={`inline-block max-w-[80%] px-4 py-2 rounded-2xl text-sm ${msg.sender_id === user?.id ? 'bg-[#4F8EF7] text-white' : 'bg-gray-100 text-gray-800'}`}>
                        <p className="text-[10px] font-medium opacity-70 mb-0.5">{msg.sender_username}</p>
                        <p>{msg.message}</p>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Replies */}
              <div className="px-4 py-2 border-t border-gray-100 flex gap-2 overflow-x-auto">
                {['Payment sent', 'Please check', 'Waiting for confirmation'].map(qr => (
                  <button key={qr} onClick={() => setNewMessage(qr)} className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full whitespace-nowrap hover:bg-gray-200">{qr}</button>
                ))}
              </div>

              {/* Input */}
              <form onSubmit={sendMessage} className="p-4 border-t border-gray-100 flex gap-2">
                <input
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm focus:border-[#4F8EF7] focus:outline-none"
                  placeholder="Type a message..."
                  data-testid="chat-message-input"
                />
                <button type="submit" className="p-2 bg-[#4F8EF7] text-white rounded-full hover:bg-[#3B7BE8] transition-colors" data-testid="chat-send-btn">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
