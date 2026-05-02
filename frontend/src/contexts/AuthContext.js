import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);
const API = process.env.REACT_APP_BACKEND_URL;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      // Try cookie-based auth first
      const res = await axios.get(`${API}/api/auth/me`, { withCredentials: true });
      setUser(res.data);
    } catch {
      // Try token from localStorage
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await axios.get(`${API}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUser(res.data);
        } catch {
          localStorage.removeItem('token');
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const login = async (email, password) => {
    const res = await axios.post(`${API}/api/auth/login`, { email, password }, { withCredentials: true });
    if (res.data.token) localStorage.setItem('token', res.data.token);
    setUser(res.data);
    return res.data;
  };

  const register = async (data) => {
    const res = await axios.post(`${API}/api/auth/register`, data, { withCredentials: true });
    if (res.data.token) localStorage.setItem('token', res.data.token);
    setUser(res.data);
    return res.data;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/api/auth/logout`, {}, { withCredentials: true });
    } catch {}
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Axios instance with auth
export const api = axios.create({ baseURL: `${API}/api` });

api.interceptors.request.use((config) => {
  config.withCredentials = true;
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
