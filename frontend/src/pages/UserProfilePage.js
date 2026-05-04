import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Star, Clock, CheckCircle, User, Award } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export default function UserProfilePage() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [username]);

  const loadProfile = async () => {
    try {
      const [profileRes, reviewsRes] = await Promise.all([
        axios.get(`${API}/api/users/${username}`),
        axios.get(`${API}/api/users/${username}/reviews`),
      ]);
      setProfile(profileRes.data);
      setReviews(reviewsRes.data);
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-[#4F8EF7] border-t-transparent rounded-full"></div></div>;
  if (!profile) return <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center text-gray-500">User not found</div>;

  return (
    <div className="min-h-screen bg-[#F0F2F5]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8" data-testid="user-profile-page">
        {/* Profile Header */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-[#4F8EF7]/10 flex items-center justify-center">
              <User className="w-8 h-8 text-[#4F8EF7]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-['Chivo'] text-2xl font-bold text-gray-900" data-testid="profile-username">{profile.username}</h1>
                {profile.is_verified_trader && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#4F8EF7]/10 text-[#4F8EF7] rounded-full text-xs font-semibold" data-testid="verified-badge">
                    <Award className="w-3.5 h-3.5" /> Verified Trader
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">Member since {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl text-center">
              <p className="text-2xl font-bold text-gray-900 font-['Chivo']">{profile.completed_trades || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Completed Trades</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl text-center">
              <p className="text-2xl font-bold text-[#10B981] font-['Chivo']">{profile.completion_rate || 0}%</p>
              <p className="text-xs text-gray-500 mt-1">Completion Rate</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl text-center">
              <p className="text-2xl font-bold text-gray-900 font-['Chivo']">{profile.total_trades || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Total Trades</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl text-center">
              <p className="text-2xl font-bold text-[#4F8EF7] font-['Chivo']">{profile.offers?.length || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Active Offers</p>
            </div>
          </div>
        </div>

        {/* Active Offers */}
        {profile.offers && profile.offers.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Active Offers</h3>
            <div className="space-y-3">
              {profile.offers.map(offer => (
                <div key={offer.id} className="p-4 bg-gray-50 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{offer.type === 'sell' ? 'Selling' : 'Buying'} USDT</p>
                    <p className="text-sm text-gray-500">{offer.network} | {offer.payment_methods?.join(', ')}</p>
                  </div>
                  <p className="font-bold text-[#4F8EF7]">₹{offer.price_inr}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">Reviews ({reviews.length})</h3>
          {reviews.length === 0 ? (
            <p className="text-gray-500 text-sm">No reviews yet</p>
          ) : (
            <div className="space-y-4">
              {reviews.map(review => (
                <div key={review.id} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900 text-sm">{review.reviewer_username}</p>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={`w-3 h-3 ${s <= review.rating ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-gray-300'}`} />
                      ))}
                    </div>
                  </div>
                  {review.comment && <p className="text-sm text-gray-600">{review.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
