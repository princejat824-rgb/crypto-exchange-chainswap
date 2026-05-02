import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth, api } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { BarChart3, Clock, CheckCircle, XCircle, Pause, Play, Trash2, Bell, Settings, List } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [trades, setTrades] = useState([]);
  const [offers, setOffers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [tab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === 'overview' || tab === 'active-trades' || tab === 'history') {
        const res = await api.get('/trades');
        setTrades(res.data);
      }
      if (tab === 'overview' || tab === 'my-offers') {
        const res = await api.get('/my-offers');
        setOffers(res.data);
      }
      if (tab === 'notifications') {
        const res = await api.get('/notifications');
        setNotifications(res.data);
        api.patch('/notifications/mark-read').catch(() => {});
      }
    } catch {} finally { setLoading(false); }
  };

  const toggleOffer = async (offerId) => {
    try {
      await api.patch(`/offers/${offerId}/toggle`);
      toast.success('Offer toggled');
      loadData();
    } catch { toast.error('Failed'); }
  };

  const deleteOffer = async (offerId) => {
    if (!window.confirm('Delete this offer?')) return;
    try {
      await api.delete(`/offers/${offerId}`);
      toast.success('Offer deleted');
      loadData();
    } catch { toast.error('Failed'); }
  };

  const activeTrades = trades.filter(t => ['INITIATED', 'PAYMENT_SENT', 'DISPUTED'].includes(t.status));
  const completedTrades = trades.filter(t => t.status === 'COMPLETED');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'my-offers', label: 'My Offers', icon: List },
    { id: 'active-trades', label: 'Active Trades', icon: Clock },
    { id: 'history', label: 'Trade History', icon: CheckCircle },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#F0F2F5]">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8" data-testid="dashboard-page">
        <h1 className="font-['Chivo'] text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
        
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2" data-testid="dashboard-tabs">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${tab === t.id ? 'bg-[#4F8EF7] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`} data-testid={`tab-${t.id}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-[#4F8EF7] border-t-transparent rounded-full"></div></div>
        ) : (
          <>
            {/* Overview Tab */}
            {tab === 'overview' && (
              <div className="space-y-6" data-testid="dashboard-overview">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Total Trades</p>
                    <p className="text-3xl font-bold text-gray-900 font-['Chivo']">{trades.length}</p>
                  </div>
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Completed</p>
                    <p className="text-3xl font-bold text-[#10B981] font-['Chivo']">{completedTrades.length}</p>
                  </div>
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Active</p>
                    <p className="text-3xl font-bold text-[#4F8EF7] font-['Chivo']">{activeTrades.length}</p>
                  </div>
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Completion Rate</p>
                    <p className="text-3xl font-bold text-gray-900 font-['Chivo']">{user?.completion_rate || 0}%</p>
                  </div>
                </div>
                
                {/* Recent Trades */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h3 className="font-semibold text-gray-900 mb-4">Recent Trades</h3>
                  {trades.length === 0 ? (
                    <p className="text-gray-500 text-sm">No trades yet. <Link to="/buy" className="text-[#4F8EF7]">Start trading</Link></p>
                  ) : (
                    <div className="space-y-3">
                      {trades.slice(0, 5).map(t => (
                        <Link to={`/trade/${t.id}`} key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors" data-testid={`trade-row-${t.id}`}>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{t.is_buyer ? 'Bought' : 'Sold'} {t.amount_usdt} USDT</p>
                            <p className="text-xs text-gray-500">with {t.counterparty}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : t.status === 'DISPUTED' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{t.status}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* My Offers Tab */}
            {tab === 'my-offers' && (
              <div className="space-y-4" data-testid="dashboard-offers">
                {offers.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                    <p className="text-gray-500 mb-4">No offers yet</p>
                    <Link to="/create-offer" className="px-6 py-2 bg-[#4F8EF7] text-white font-semibold rounded-full">Create Offer</Link>
                  </div>
                ) : offers.map(offer => (
                  <div key={offer.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4" data-testid={`my-offer-${offer.id}`}>
                    <div>
                      <p className="font-semibold text-gray-900">{offer.type === 'sell' ? 'Selling' : 'Buying'} USDT</p>
                      <p className="text-sm text-gray-500">₹{offer.price_inr}/USDT | {offer.network} | {offer.available_usdt} USDT</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${offer.is_paused ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                        {offer.is_paused ? 'Paused' : 'Active'}
                      </span>
                      <button onClick={() => toggleOffer(offer.id)} className="p-2 hover:bg-gray-100 rounded-lg" title={offer.is_paused ? 'Resume' : 'Pause'}>
                        {offer.is_paused ? <Play className="w-4 h-4 text-green-600" /> : <Pause className="w-4 h-4 text-yellow-600" />}
                      </button>
                      <button onClick={() => deleteOffer(offer.id)} className="p-2 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Active Trades Tab */}
            {tab === 'active-trades' && (
              <div className="space-y-4" data-testid="dashboard-active-trades">
                {activeTrades.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                    <p className="text-gray-500">No active trades</p>
                  </div>
                ) : activeTrades.map(t => (
                  <Link to={`/trade/${t.id}`} key={t.id} className="block bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:-translate-y-0.5 transition-transform" data-testid={`active-trade-${t.id}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{t.is_buyer ? 'Buying' : 'Selling'} {t.amount_usdt} USDT</p>
                        <p className="text-sm text-gray-500">with {t.counterparty} | ₹{t.amount_inr?.toFixed(2)}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${t.status === 'DISPUTED' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{t.status}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Trade History Tab */}
            {tab === 'history' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" data-testid="dashboard-history">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Counterparty</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {trades.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/trade/${t.id}`)}>
                        <td className="px-6 py-4 text-gray-700">{new Date(t.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4">{t.is_buyer ? 'Buy' : 'Sell'}</td>
                        <td className="px-6 py-4 font-medium">{t.amount_usdt} USDT</td>
                        <td className="px-6 py-4">{t.counterparty}</td>
                        <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full text-xs ${t.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : t.status === 'CANCELLED' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>{t.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {trades.length === 0 && <p className="text-center py-8 text-gray-500">No trade history</p>}
              </div>
            )}

            {/* Notifications Tab */}
            {tab === 'notifications' && (
              <div className="space-y-3" data-testid="dashboard-notifications">
                {notifications.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                    <p className="text-gray-500">No notifications</p>
                  </div>
                ) : notifications.map(n => (
                  <div key={n.id} className={`bg-white rounded-2xl p-4 shadow-sm border ${n.is_read ? 'border-gray-100' : 'border-[#4F8EF7]/20 bg-blue-50/30'}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-800">{n.message}</p>
                      <p className="text-xs text-gray-400">{new Date(n.created_at).toLocaleDateString()}</p>
                    </div>
                    {n.trade_id && <Link to={`/trade/${n.trade_id}`} className="text-xs text-[#4F8EF7] mt-1 inline-block">View Trade</Link>}
                  </div>
                ))}
              </div>
            )}

            {/* Settings Tab */}
            {tab === 'settings' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100" data-testid="dashboard-settings">
                <h3 className="font-semibold text-gray-900 mb-4">Profile Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">Username</label>
                    <p className="text-gray-900 font-medium">{user?.username}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">Email</label>
                    <p className="text-gray-900">{user?.email}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">Wallet Address</label>
                    <p className="text-gray-900">{user?.wallet_address || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">Member Since</label>
                    <p className="text-gray-900">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
