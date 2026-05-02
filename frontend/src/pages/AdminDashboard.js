import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, api } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Users, TrendingUp, AlertTriangle, Package, Eye, Ban, CheckCircle, XCircle, BarChart3, List, Shield, Settings, Download, FileText, Calendar } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [trades, setTrades] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState(30);
  const [topTraders, setTopTraders] = useState([]);

  useEffect(() => { loadData(); }, [tab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === 'overview') {
        const res = await api.get('/admin/stats');
        setStats(res.data);
      }
      if (tab === 'users') {
        const res = await api.get(`/admin/users${searchQuery ? `?search=${searchQuery}` : ''}`);
        setUsers(res.data);
      }
      if (tab === 'trades') {
        const res = await api.get('/admin/trades');
        setTrades(res.data);
      }
      if (tab === 'disputes') {
        const res = await api.get('/admin/disputes');
        setDisputes(res.data);
      }
      if (tab === 'offers') {
        const res = await api.get('/admin/offers');
        setOffers(res.data);
      }
      if (tab === 'reports') {
        const res = await api.get(`/admin/analytics?days=${analyticsPeriod}`);
        setAnalytics(res.data);
        const traders = await api.get(`/admin/top-traders?days=${analyticsPeriod}`);
        setTopTraders(traders.data);
      }
    } catch {} finally { setLoading(false); }
  };

  const banUser = async (userId, isBanned) => {
    const reason = isBanned ? '' : prompt('Reason for ban:');
    if (!isBanned && !reason) return;
    try {
      await api.patch(`/admin/users/${userId}/ban`, { is_banned: !isBanned, reason });
      toast.success(isBanned ? 'User unbanned' : 'User banned');
      loadData();
    } catch { toast.error('Failed'); }
  };

  const resolveDispute = async (tradeId, resolution) => {
    const note = prompt('Admin note (required):');
    if (!note) return;
    try {
      await api.post(`/admin/trades/${tradeId}/resolve`, { resolution, admin_note: note });
      toast.success('Dispute resolved');
      loadData();
    } catch { toast.error('Failed to resolve'); }
  };

  const deleteOffer = async (offerId) => {
    if (!window.confirm('Delete this offer?')) return;
    try {
      await api.delete(`/admin/offers/${offerId}`);
      toast.success('Offer deleted');
      loadData();
    } catch { toast.error('Failed'); }
  };

  const sidebarItems = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'trades', label: 'Trades', icon: TrendingUp },
    { id: 'disputes', label: 'Disputes', icon: AlertTriangle, badge: stats.open_disputes },
    { id: 'offers', label: 'Offers', icon: Package },
    { id: 'reports', label: 'Reports', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex" data-testid="admin-dashboard">
      {/* Sidebar */}
      <aside className="w-64 bg-[#141414] border-r border-white/5 min-h-screen p-4 hidden lg:block">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="w-8 h-8 rounded-lg bg-[#4F8EF7] flex items-center justify-center text-white text-sm font-bold">CS</div>
          <span className="font-black text-lg font-['Chivo']">Admin</span>
        </div>
        <nav className="space-y-1">
          {sidebarItems.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${tab === item.id ? 'bg-[#4F8EF7] text-white' : 'text-[#A1A1AA] hover:bg-white/5 hover:text-white'}`} data-testid={`admin-tab-${item.id}`}>
              <item.icon className="w-4 h-4" />
              {item.label}
              {item.badge > 0 && <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{item.badge}</span>}
            </button>
          ))}
        </nav>
        <div className="mt-8 pt-4 border-t border-white/5">
          <Link to="/dashboard" className="flex items-center gap-2 px-3 py-2 text-sm text-[#A1A1AA] hover:text-white">
            <Shield className="w-4 h-4" /> User Dashboard
          </Link>
          <button onClick={logout} className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 w-full mt-1" data-testid="admin-logout">
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        {/* Mobile tab selector */}
        <div className="lg:hidden flex gap-2 mb-6 overflow-x-auto pb-2">
          {sidebarItems.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm whitespace-nowrap ${tab === item.id ? 'bg-[#4F8EF7] text-white' : 'bg-[#141414] text-[#A1A1AA]'}`}>
              <item.icon className="w-4 h-4" /> {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-[#4F8EF7] border-t-transparent rounded-full"></div></div>
        ) : (
          <>
            {/* Overview */}
            {tab === 'overview' && (
              <div data-testid="admin-overview">
                <h2 className="font-['Chivo'] text-2xl font-bold mb-6">Dashboard Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                  <div className="bg-[#141414] rounded-2xl p-6 border border-white/5">
                    <p className="text-sm text-[#A1A1AA]">Total Users</p>
                    <p className="text-3xl font-bold font-['Chivo'] mt-1">{stats.total_users || 0}</p>
                  </div>
                  <div className="bg-[#141414] rounded-2xl p-6 border border-white/5">
                    <p className="text-sm text-[#A1A1AA]">Active (24h)</p>
                    <p className="text-3xl font-bold font-['Chivo'] mt-1 text-[#10B981]">{stats.active_users_24h || 0}</p>
                  </div>
                  <div className="bg-[#141414] rounded-2xl p-6 border border-white/5">
                    <p className="text-sm text-[#A1A1AA]">Trades Today</p>
                    <p className="text-3xl font-bold font-['Chivo'] mt-1 text-[#4F8EF7]">{stats.total_trades_today || 0}</p>
                  </div>
                  <div className="bg-[#141414] rounded-2xl p-6 border border-white/5">
                    <p className="text-sm text-[#A1A1AA]">Open Disputes</p>
                    <p className="text-3xl font-bold font-['Chivo'] mt-1 text-[#EF4444]">{stats.open_disputes || 0}</p>
                  </div>
                </div>
                <div className="bg-[#141414] rounded-2xl p-6 border border-white/5">
                  <p className="text-sm text-[#A1A1AA]">Volume Today (INR)</p>
                  <p className="text-2xl font-bold font-['Chivo'] mt-1">₹{(stats.volume_today || 0).toLocaleString()}</p>
                </div>
              </div>
            )}

            {/* Users */}
            {tab === 'users' && (
              <div data-testid="admin-users">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-['Chivo'] text-2xl font-bold">Users Management</h2>
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadData()} placeholder="Search users..." className="px-4 py-2 bg-[#141414] border border-white/10 rounded-xl text-white text-sm focus:border-[#4F8EF7] focus:outline-none w-64" data-testid="admin-user-search" />
                </div>
                <div className="bg-[#141414] rounded-2xl border border-white/5 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="border-b border-white/5">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs text-[#A1A1AA]">Username</th>
                        <th className="px-4 py-3 text-left text-xs text-[#A1A1AA]">Email</th>
                        <th className="px-4 py-3 text-left text-xs text-[#A1A1AA]">Trades</th>
                        <th className="px-4 py-3 text-left text-xs text-[#A1A1AA]">Status</th>
                        <th className="px-4 py-3 text-left text-xs text-[#A1A1AA]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-white/5">
                          <td className="px-4 py-3 font-medium">{u.username}</td>
                          <td className="px-4 py-3 text-[#A1A1AA]">{u.email}</td>
                          <td className="px-4 py-3">{u.completed_trades || 0}/{u.total_trades || 0}</td>
                          <td className="px-4 py-3">
                            {u.is_banned ? <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs">Banned</span> : <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs">Active</span>}
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => banUser(u.id, u.is_banned)} className={`px-3 py-1 rounded-full text-xs font-medium ${u.is_banned ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`} data-testid={`ban-user-${u.id}`}>
                              {u.is_banned ? 'Unban' : 'Ban'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Trades */}
            {tab === 'trades' && (
              <div data-testid="admin-trades">
                <h2 className="font-['Chivo'] text-2xl font-bold mb-6">All Trades</h2>
                <div className="bg-[#141414] rounded-2xl border border-white/5 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-white/5">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs text-[#A1A1AA]">ID</th>
                        <th className="px-4 py-3 text-left text-xs text-[#A1A1AA]">Buyer</th>
                        <th className="px-4 py-3 text-left text-xs text-[#A1A1AA]">Seller</th>
                        <th className="px-4 py-3 text-left text-xs text-[#A1A1AA]">Amount</th>
                        <th className="px-4 py-3 text-left text-xs text-[#A1A1AA]">Status</th>
                        <th className="px-4 py-3 text-left text-xs text-[#A1A1AA]">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {trades.map(t => (
                        <tr key={t.id} className="hover:bg-white/5">
                          <td className="px-4 py-3 font-mono text-xs">{t.id?.slice(0, 8)}...</td>
                          <td className="px-4 py-3">{t.buyer_username}</td>
                          <td className="px-4 py-3">{t.seller_username}</td>
                          <td className="px-4 py-3">{t.amount_usdt} USDT</td>
                          <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${t.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' : t.status === 'DISPUTED' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>{t.status}</span></td>
                          <td className="px-4 py-3 text-[#A1A1AA]">{new Date(t.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {trades.length === 0 && <p className="text-center py-8 text-[#A1A1AA]">No trades</p>}
                </div>
              </div>
            )}

            {/* Disputes */}
            {tab === 'disputes' && (
              <div data-testid="admin-disputes">
                <h2 className="font-['Chivo'] text-2xl font-bold mb-6 flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-[#EF4444]" /> Disputes
                </h2>
                {disputes.length === 0 ? (
                  <div className="bg-[#141414] rounded-2xl p-8 border border-white/5 text-center text-[#A1A1AA]">No open disputes</div>
                ) : (
                  <div className="space-y-4">
                    {disputes.map(d => (
                      <div key={d.id} className="bg-[#141414] rounded-2xl p-6 border border-red-500/20" data-testid={`dispute-${d.id}`}>
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                          <div>
                            <p className="font-semibold">Trade #{d.id?.slice(0, 8)}</p>
                            <p className="text-sm text-[#A1A1AA]">{d.buyer_username} (Buyer) vs {d.seller_username} (Seller)</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-[#4F8EF7]">{d.amount_usdt} USDT = ₹{d.amount_inr?.toFixed(2)}</p>
                            <p className="text-xs text-[#A1A1AA]">{d.payment_method}</p>
                          </div>
                        </div>
                        {d.dispute_reason && (
                          <div className="p-3 bg-red-500/10 rounded-xl mb-4 text-sm text-red-300">
                            <strong>Reason:</strong> {d.dispute_reason}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => resolveDispute(d.id, 'release_buyer')} className="px-4 py-2 bg-green-500/20 text-green-400 rounded-full text-sm font-medium hover:bg-green-500/30" data-testid={`resolve-buyer-${d.id}`}>Release to Buyer</button>
                          <button onClick={() => resolveDispute(d.id, 'release_seller')} className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium hover:bg-blue-500/30" data-testid={`resolve-seller-${d.id}`}>Release to Seller</button>
                          <button onClick={() => resolveDispute(d.id, 'cancel')} className="px-4 py-2 bg-gray-500/20 text-gray-400 rounded-full text-sm font-medium hover:bg-gray-500/30" data-testid={`resolve-cancel-${d.id}`}>Cancel Trade</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Offers */}
            {tab === 'offers' && (
              <div data-testid="admin-offers">
                <h2 className="font-['Chivo'] text-2xl font-bold mb-6">All Offers</h2>
                <div className="bg-[#141414] rounded-2xl border border-white/5 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="border-b border-white/5">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs text-[#A1A1AA]">User</th>
                        <th className="px-4 py-3 text-left text-xs text-[#A1A1AA]">Type</th>
                        <th className="px-4 py-3 text-left text-xs text-[#A1A1AA]">Price</th>
                        <th className="px-4 py-3 text-left text-xs text-[#A1A1AA]">Available</th>
                        <th className="px-4 py-3 text-left text-xs text-[#A1A1AA]">Status</th>
                        <th className="px-4 py-3 text-left text-xs text-[#A1A1AA]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {offers.map(o => (
                        <tr key={o.id} className="hover:bg-white/5">
                          <td className="px-4 py-3">{o.username}</td>
                          <td className="px-4 py-3 capitalize">{o.type}</td>
                          <td className="px-4 py-3">₹{o.price_inr}</td>
                          <td className="px-4 py-3">{o.available_usdt} USDT</td>
                          <td className="px-4 py-3">{o.is_paused ? <span className="text-yellow-400">Paused</span> : <span className="text-green-400">Active</span>}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => deleteOffer(o.id)} className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-xs hover:bg-red-500/30">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {offers.length === 0 && <p className="text-center py-8 text-[#A1A1AA]">No offers</p>}
                </div>
              </div>
            )}

            {/* Reports */}
            {tab === 'reports' && (
              <div data-testid="admin-reports">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-['Chivo'] text-2xl font-bold">Reports & Analytics</h2>
                  <div className="flex gap-2">
                    {[7, 14, 30, 90].map(d => (
                      <button key={d} onClick={() => { setAnalyticsPeriod(d); api.get(`/admin/analytics?days=${d}`).then(r => setAnalytics(r.data)).catch(() => {}); }} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${analyticsPeriod === d ? 'bg-[#4F8EF7] text-white' : 'bg-white/5 text-[#A1A1AA] hover:bg-white/10'}`} data-testid={`period-${d}d`}>{d}D</button>
                    ))}
                  </div>
                </div>

                {/* Analytics Charts */}
                {analytics && (
                  <>
                    {/* Summary Cards with Trends */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-[#141414] rounded-2xl p-5 border border-white/5">
                        <p className="text-xs text-[#A1A1AA] uppercase tracking-wider">Total Volume</p>
                        <p className="text-2xl font-bold font-['Chivo'] mt-1 text-[#4F8EF7]">₹{(analytics.summary.total_volume_inr || 0).toLocaleString()}</p>
                        {analytics.trends && (
                          <p className={`text-xs mt-1 font-medium ${analytics.trends.volume_change >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`} data-testid="volume-trend">
                            {analytics.trends.volume_change >= 0 ? '↑' : '↓'} {Math.abs(analytics.trends.volume_change)}% vs prev {analyticsPeriod}d
                          </p>
                        )}
                      </div>
                      <div className="bg-[#141414] rounded-2xl p-5 border border-white/5">
                        <p className="text-xs text-[#A1A1AA] uppercase tracking-wider">Total Trades</p>
                        <p className="text-2xl font-bold font-['Chivo'] mt-1">{analytics.summary.total_trades}</p>
                        {analytics.trends && (
                          <p className={`text-xs mt-1 font-medium ${analytics.trends.trades_change >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`} data-testid="trades-trend">
                            {analytics.trends.trades_change >= 0 ? '↑' : '↓'} {Math.abs(analytics.trends.trades_change)}% vs prev {analyticsPeriod}d
                          </p>
                        )}
                      </div>
                      <div className="bg-[#141414] rounded-2xl p-5 border border-white/5">
                        <p className="text-xs text-[#A1A1AA] uppercase tracking-wider">Completion Rate</p>
                        <p className="text-2xl font-bold font-['Chivo'] mt-1 text-[#10B981]">{analytics.summary.completion_rate}%</p>
                      </div>
                      <div className="bg-[#141414] rounded-2xl p-5 border border-white/5">
                        <p className="text-xs text-[#A1A1AA] uppercase tracking-wider">New Users</p>
                        <p className="text-2xl font-bold font-['Chivo'] mt-1 text-[#F59E0B]">{analytics.summary.total_new_users}</p>
                        {analytics.trends && (
                          <p className={`text-xs mt-1 font-medium ${analytics.trends.users_change >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`} data-testid="users-trend">
                            {analytics.trends.users_change >= 0 ? '↑' : '↓'} {Math.abs(analytics.trends.users_change)}% vs prev {analyticsPeriod}d
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Volume Chart */}
                    <div className="bg-[#141414] rounded-2xl p-6 border border-white/5 mb-6" data-testid="volume-chart">
                      <h3 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#4F8EF7]" /> Trade Volume (INR)</h3>
                      {analytics.daily_trades.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <AreaChart data={analytics.daily_trades}>
                            <defs>
                              <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4F8EF7" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#4F8EF7" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                            <XAxis dataKey="date" tick={{ fill: '#A1A1AA', fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                            <YAxis tick={{ fill: '#A1A1AA', fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                            <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', color: '#fff' }} formatter={(v) => [`₹${v.toLocaleString()}`, 'Volume']} labelFormatter={l => `Date: ${l}`} />
                            <Area type="monotone" dataKey="volume_inr" stroke="#4F8EF7" fill="url(#volumeGradient)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-[#A1A1AA] text-sm text-center py-12">No trade data for this period</p>
                      )}
                    </div>

                    {/* Trades Count Chart */}
                    <div className="bg-[#141414] rounded-2xl p-6 border border-white/5 mb-6" data-testid="trades-chart">
                      <h3 className="font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-[#10B981]" /> Daily Trades</h3>
                      {analytics.daily_trades.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={analytics.daily_trades}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                            <XAxis dataKey="date" tick={{ fill: '#A1A1AA', fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                            <YAxis tick={{ fill: '#A1A1AA', fontSize: 11 }} />
                            <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', color: '#fff' }} />
                            <Legend wrapperStyle={{ color: '#A1A1AA', fontSize: 12 }} />
                            <Bar dataKey="completed" name="Completed" fill="#10B981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="disputed" name="Disputed" fill="#EF4444" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="trades" name="Total" fill="#4F8EF7" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-[#A1A1AA] text-sm text-center py-12">No trade data for this period</p>
                      )}
                    </div>

                    {/* Breakdowns Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      {/* Payment Method Breakdown */}
                      <div className="bg-[#141414] rounded-2xl p-6 border border-white/5" data-testid="payment-breakdown">
                        <h3 className="font-semibold mb-4">Payment Methods</h3>
                        {analytics.payment_breakdown.length > 0 ? (
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie data={analytics.payment_breakdown} dataKey="count" nameKey="method" cx="50%" cy="50%" outerRadius={70} label={({ method, percent }) => `${method} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                                {analytics.payment_breakdown.map((_, i) => (
                                  <Cell key={i} fill={['#4F8EF7', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'][i % 6]} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', color: '#fff' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <p className="text-[#A1A1AA] text-sm text-center py-8">No data</p>
                        )}
                      </div>

                      {/* Network Breakdown */}
                      <div className="bg-[#141414] rounded-2xl p-6 border border-white/5" data-testid="network-breakdown">
                        <h3 className="font-semibold mb-4">Network Usage</h3>
                        {analytics.network_breakdown.length > 0 ? (
                          <>
                            <ResponsiveContainer width="100%" height={140}>
                              <BarChart data={analytics.network_breakdown} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                                <XAxis type="number" tick={{ fill: '#A1A1AA', fontSize: 11 }} />
                                <YAxis type="category" dataKey="network" tick={{ fill: '#A1A1AA', fontSize: 11 }} width={55} />
                                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', color: '#fff' }} formatter={(v) => [v, 'Trades']} />
                                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                  {analytics.network_breakdown.map((entry, i) => (
                                    <Cell key={i} fill={entry.network === 'TRC20' ? '#EF4444' : entry.network === 'ERC20' ? '#627EEA' : '#F3BA2F'} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                            <div className="mt-3 space-y-2">
                              {analytics.network_breakdown.map(n => (
                                <div key={n.network} className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: n.network === 'TRC20' ? '#EF4444' : n.network === 'ERC20' ? '#627EEA' : '#F3BA2F' }}></div>
                                    <span className="text-[#A1A1AA]">{n.network}</span>
                                  </div>
                                  <span className="font-medium">₹{n.volume.toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <p className="text-[#A1A1AA] text-sm text-center py-8">No data</p>
                        )}
                      </div>

                      {/* Status Breakdown */}
                      <div className="bg-[#141414] rounded-2xl p-6 border border-white/5" data-testid="status-breakdown">
                        <h3 className="font-semibold mb-4">Trade Status Distribution</h3>
                        {analytics.status_breakdown.length > 0 ? (
                          <div className="space-y-3">
                            {analytics.status_breakdown.map(s => {
                              const colors = { COMPLETED: '#10B981', INITIATED: '#4F8EF7', PAYMENT_SENT: '#F59E0B', DISPUTED: '#EF4444', CANCELLED: '#6B7280', EXPIRED: '#9CA3AF' };
                              const total = analytics.summary.total_trades || 1;
                              const pct = ((s.count / total) * 100).toFixed(1);
                              return (
                                <div key={s.status}>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="text-[#A1A1AA]">{s.status}</span>
                                    <span className="font-medium">{s.count} ({pct}%)</span>
                                  </div>
                                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: colors[s.status] || '#4F8EF7' }}></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[#A1A1AA] text-sm text-center py-8">No data</p>
                        )}
                      </div>
                    </div>

                    {/* New Users Chart */}
                    {analytics.daily_users.length > 0 && (
                      <div className="bg-[#141414] rounded-2xl p-6 border border-white/5 mb-6" data-testid="users-chart">
                        <h3 className="font-semibold mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-[#F59E0B]" /> New User Registrations</h3>
                        <ResponsiveContainer width="100%" height={180}>
                          <AreaChart data={analytics.daily_users}>
                            <defs>
                              <linearGradient id="usersGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                            <XAxis dataKey="date" tick={{ fill: '#A1A1AA', fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                            <YAxis tick={{ fill: '#A1A1AA', fontSize: 11 }} />
                            <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', color: '#fff' }} />
                            <Area type="monotone" dataKey="new_users" stroke="#F59E0B" fill="url(#usersGradient)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </>
                )}

                {/* Top Traders Leaderboard */}
                <div className="bg-[#141414] rounded-2xl p-6 border border-white/5 mb-6" data-testid="top-traders-leaderboard">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-semibold flex items-center gap-2">
                      <svg className="w-5 h-5 text-[#F59E0B]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                      Top Traders
                    </h3>
                    <span className="text-xs text-[#A1A1AA]">Last {analyticsPeriod} days</span>
                  </div>
                  {topTraders.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/5">
                            <th className="pb-3 text-left text-xs text-[#A1A1AA] font-medium">#</th>
                            <th className="pb-3 text-left text-xs text-[#A1A1AA] font-medium">Trader</th>
                            <th className="pb-3 text-right text-xs text-[#A1A1AA] font-medium">Volume (INR)</th>
                            <th className="pb-3 text-right text-xs text-[#A1A1AA] font-medium">USDT</th>
                            <th className="pb-3 text-right text-xs text-[#A1A1AA] font-medium">Trades</th>
                            <th className="pb-3 text-right text-xs text-[#A1A1AA] font-medium">Buy/Sell</th>
                            <th className="pb-3 text-right text-xs text-[#A1A1AA] font-medium">Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topTraders.map(trader => (
                            <tr key={trader.rank} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                              <td className="py-3">
                                {trader.rank <= 3 ? (
                                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${trader.rank === 1 ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : trader.rank === 2 ? 'bg-[#A1A1AA]/20 text-[#A1A1AA]' : 'bg-[#CD7F32]/20 text-[#CD7F32]'}`}>
                                    {trader.rank}
                                  </span>
                                ) : (
                                  <span className="text-[#A1A1AA] pl-1.5">{trader.rank}</span>
                                )}
                              </td>
                              <td className="py-3">
                                <span className="font-medium">{trader.username}</span>
                              </td>
                              <td className="py-3 text-right font-medium text-[#4F8EF7]">₹{trader.total_volume_inr.toLocaleString()}</td>
                              <td className="py-3 text-right">{trader.total_volume_usdt.toFixed(1)}</td>
                              <td className="py-3 text-right">{trader.total_trades}</td>
                              <td className="py-3 text-right">
                                <span className="text-[#4F8EF7]">{trader.buy_trades}</span>
                                <span className="text-[#A1A1AA] mx-0.5">/</span>
                                <span className="text-[#10B981]">{trader.sell_trades}</span>
                              </td>
                              <td className="py-3 text-right">
                                <span className={`${trader.completion_rate >= 80 ? 'text-[#10B981]' : trader.completion_rate >= 50 ? 'text-[#F59E0B]' : 'text-[#A1A1AA]'}`}>
                                  {trader.completion_rate}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-[#A1A1AA] text-sm">No trader activity in this period</p>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-white/5 my-8"></div>
                <h3 className="font-['Chivo'] text-xl font-bold mb-6">Export Data</h3>

                {/* Date Range Filter */}
                <div className="bg-[#141414] rounded-2xl p-6 border border-white/5 mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-5 h-5 text-[#4F8EF7]" />
                    <h3 className="font-semibold">Date Range Filter</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-[#A1A1AA] mb-1 block">Start Date</label>
                      <input
                        type="date"
                        value={exportStartDate}
                        onChange={e => setExportStartDate(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#0A0A0A] border border-white/10 rounded-xl text-white text-sm focus:border-[#4F8EF7] focus:outline-none [color-scheme:dark]"
                        data-testid="export-start-date"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#A1A1AA] mb-1 block">End Date</label>
                      <input
                        type="date"
                        value={exportEndDate}
                        onChange={e => setExportEndDate(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#0A0A0A] border border-white/10 rounded-xl text-white text-sm focus:border-[#4F8EF7] focus:outline-none [color-scheme:dark]"
                        data-testid="export-end-date"
                      />
                    </div>
                  </div>
                  {(exportStartDate || exportEndDate) && (
                    <button
                      onClick={() => { setExportStartDate(''); setExportEndDate(''); }}
                      className="mt-3 text-xs text-[#A1A1AA] hover:text-white transition-colors"
                      data-testid="clear-date-filter"
                    >
                      Clear date filter
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-[#141414] rounded-2xl p-6 border border-white/5">
                    <div className="flex items-center gap-3 mb-4">
                      <Download className="w-6 h-6 text-[#4F8EF7]" />
                      <h3 className="font-semibold text-lg">Trades Report</h3>
                    </div>
                    <p className="text-[#A1A1AA] text-sm mb-4">Download trades data as CSV. Includes buyer, seller, amounts, status, and dates.</p>
                    {(exportStartDate || exportEndDate) && (
                      <p className="text-xs text-[#4F8EF7] mb-4">Filtered: {exportStartDate || 'beginning'} to {exportEndDate || 'now'}</p>
                    )}
                    <button
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#4F8EF7] text-white font-semibold rounded-full hover:bg-[#3B7BE8] transition-colors"
                      data-testid="export-trades-btn"
                      onClick={() => {
                        const token = localStorage.getItem('token');
                        let url = `${process.env.REACT_APP_BACKEND_URL}/api/admin/export/trades`;
                        const params = new URLSearchParams();
                        if (exportStartDate) params.append('start_date', exportStartDate);
                        if (exportEndDate) params.append('end_date', exportEndDate);
                        if (params.toString()) url += `?${params.toString()}`;
                        fetch(url, {
                          headers: { Authorization: `Bearer ${token}` },
                          credentials: 'include'
                        }).then(res => res.blob()).then(blob => {
                          const a = document.createElement('a');
                          a.href = window.URL.createObjectURL(blob);
                          a.download = `trades_export_${exportStartDate || 'all'}_to_${exportEndDate || 'now'}.csv`;
                          a.click(); window.URL.revokeObjectURL(a.href);
                          toast.success('Trades CSV downloaded!');
                        }).catch(() => toast.error('Download failed'));
                      }}
                    >
                      <Download className="w-4 h-4" /> Export Trades CSV
                    </button>
                  </div>
                  
                  <div className="bg-[#141414] rounded-2xl p-6 border border-white/5">
                    <div className="flex items-center gap-3 mb-4">
                      <Download className="w-6 h-6 text-[#10B981]" />
                      <h3 className="font-semibold text-lg">Users Report</h3>
                    </div>
                    <p className="text-[#A1A1AA] text-sm mb-4">Download users data as CSV. Includes username, email, trades, completion rate, and status.</p>
                    {(exportStartDate || exportEndDate) && (
                      <p className="text-xs text-[#10B981] mb-4">Filtered: {exportStartDate || 'beginning'} to {exportEndDate || 'now'}</p>
                    )}
                    <button
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#10B981] text-white font-semibold rounded-full hover:bg-[#059669] transition-colors"
                      data-testid="export-users-btn"
                      onClick={() => {
                        const token = localStorage.getItem('token');
                        let url = `${process.env.REACT_APP_BACKEND_URL}/api/admin/export/users`;
                        const params = new URLSearchParams();
                        if (exportStartDate) params.append('start_date', exportStartDate);
                        if (exportEndDate) params.append('end_date', exportEndDate);
                        if (params.toString()) url += `?${params.toString()}`;
                        fetch(url, {
                          headers: { Authorization: `Bearer ${token}` },
                          credentials: 'include'
                        }).then(res => res.blob()).then(blob => {
                          const a = document.createElement('a');
                          a.href = window.URL.createObjectURL(blob);
                          a.download = `users_export_${exportStartDate || 'all'}_to_${exportEndDate || 'now'}.csv`;
                          a.click(); window.URL.revokeObjectURL(a.href);
                          toast.success('Users CSV downloaded!');
                        }).catch(() => toast.error('Download failed'));
                      }}
                    >
                      <Download className="w-4 h-4" /> Export Users CSV
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
