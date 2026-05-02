import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, api } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Users, TrendingUp, AlertTriangle, Package, Eye, Ban, CheckCircle, XCircle, BarChart3, List, Shield, Settings, Download, FileText } from 'lucide-react';

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
                <h2 className="font-['Chivo'] text-2xl font-bold mb-6">Reports & Export</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-[#141414] rounded-2xl p-6 border border-white/5">
                    <div className="flex items-center gap-3 mb-4">
                      <Download className="w-6 h-6 text-[#4F8EF7]" />
                      <h3 className="font-semibold text-lg">Trades Report</h3>
                    </div>
                    <p className="text-[#A1A1AA] text-sm mb-6">Download all trades data as CSV. Includes buyer, seller, amounts, status, and dates.</p>
                    <a
                      href={`${process.env.REACT_APP_BACKEND_URL}/api/admin/export/trades`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#4F8EF7] text-white font-semibold rounded-full hover:bg-[#3B7BE8] transition-colors"
                      data-testid="export-trades-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        const token = localStorage.getItem('token');
                        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/export/trades`, {
                          headers: { Authorization: `Bearer ${token}` },
                          credentials: 'include'
                        }).then(res => res.blob()).then(blob => {
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a'); a.href = url;
                          a.download = `trades_export_${new Date().toISOString().slice(0,10)}.csv`;
                          a.click(); window.URL.revokeObjectURL(url);
                          toast.success('Trades CSV downloaded!');
                        }).catch(() => toast.error('Download failed'));
                      }}
                    >
                      <Download className="w-4 h-4" /> Export Trades CSV
                    </a>
                  </div>
                  
                  <div className="bg-[#141414] rounded-2xl p-6 border border-white/5">
                    <div className="flex items-center gap-3 mb-4">
                      <Download className="w-6 h-6 text-[#10B981]" />
                      <h3 className="font-semibold text-lg">Users Report</h3>
                    </div>
                    <p className="text-[#A1A1AA] text-sm mb-6">Download all users data as CSV. Includes username, email, trades, completion rate, and status.</p>
                    <button
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#10B981] text-white font-semibold rounded-full hover:bg-[#059669] transition-colors"
                      data-testid="export-users-btn"
                      onClick={() => {
                        const token = localStorage.getItem('token');
                        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/export/users`, {
                          headers: { Authorization: `Bearer ${token}` },
                          credentials: 'include'
                        }).then(res => res.blob()).then(blob => {
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a'); a.href = url;
                          a.download = `users_export_${new Date().toISOString().slice(0,10)}.csv`;
                          a.click(); window.URL.revokeObjectURL(url);
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
