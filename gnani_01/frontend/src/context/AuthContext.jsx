import { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { BACKEND_URL } from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const API_BASE_URL = BACKEND_URL;

// Demo users for offline fallback
const demoUsers = [
  {
    id: 'admin-1',
    name: 'SwachhMap System Administrator',
    email: 'admin@swachhmap.gov.in',
    password: 'admin123',
    role: 'admin'
  },
  {
    id: 'admin-2',
    name: 'Admin User',
    email: 'admin@swachhmap.com',
    password: 'admin123',
    role: 'admin'
  },
  {
    id: 'citizen-1',
    name: 'John Citizen',
    email: 'citizen@swachhmap.com',
    password: 'citizen123',
    role: 'citizen'
  },
  {
    id: 'citizen-2',
    name: 'Demo Citizen',
    email: 'demo@test.com',
    password: 'demo123',
    role: 'citizen'
  }
];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage
    const savedUser = localStorage.getItem('swachhmap_user');

    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        console.log('✅ User session restored:', userData.name, `(${userData.role})`);
      } catch (error) {
        console.error('❌ Error parsing saved user:', error);
        localStorage.removeItem('swachhmap_user');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  // Citizen Login (Public Authentication)
  const login = async (email, password) => {
    try {
      console.log('🔐 Citizen login attempt via API for:', email);
      const res = await axios.post(`${API_BASE_URL}/api/auth/login`, { email, password }, { timeout: 7000 });
      if (res.data.success && res.data.token) {
        const userData = res.data.user;
        setUser(userData);
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('swachhmap_user', JSON.stringify(userData));
        return { success: true, user: userData };
      }
    } catch (err) {
      console.warn('⚠️ API login failed or server offline, checking fallback:', err.response?.data?.message || err.message);
      if (err.response?.status === 401 || err.response?.status === 400) {
        return { success: false, message: err.response?.data?.message || 'Invalid email or password' };
      }
    }

    // Fallback for demonstration when backend is temporarily offline
    const found = demoUsers.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (found) {
      const userData = { id: found.id, name: found.name, email: found.email, role: found.role };
      setUser(userData);
      localStorage.setItem('token', 'demo-jwt-token-' + found.id);
      localStorage.setItem('swachhmap_user', JSON.stringify(userData));
      return { success: true, user: userData };
    }

    return { success: false, message: 'Invalid credentials. Please verify your email and password.' };
  };

  // Dedicated Admin Login (Strict Role Enforcement)
  const adminLogin = async (email, password) => {
    try {
      console.log('🛡️ Admin portal authentication via API for:', email);
      const res = await axios.post(`${API_BASE_URL}/api/admin/login`, { email, password }, { timeout: 7000 });
      if (res.data.success && res.data.token) {
        const adminData = res.data.admin;
        setUser(adminData);
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('swachhmap_user', JSON.stringify(adminData));
        return { success: true, admin: adminData };
      }
    } catch (err) {
      console.warn('⚠️ Admin API login error:', err.response?.data || err.message);
      if (err.response?.status === 403) {
        return {
          success: false,
          message: err.response?.data?.message || 'Access denied: Citizen accounts cannot log in to the administrative portal.'
        };
      }
      if (err.response?.status === 401) {
        return { success: false, message: 'Invalid administrative credentials.' };
      }
    }

    // Offline Demo Fallback for Admin
    const foundAdmin = demoUsers.find(u => 
      u.email.toLowerCase() === email.toLowerCase() && 
      u.password === password
    );

    if (foundAdmin) {
      if (foundAdmin.role !== 'admin') {
        return {
          success: false,
          message: 'Access denied: Citizen accounts cannot log in to the administrative portal.'
        };
      }
      const adminData = { id: foundAdmin.id, name: foundAdmin.name, email: foundAdmin.email, role: 'admin' };
      setUser(adminData);
      localStorage.setItem('token', 'demo-admin-jwt-token');
      localStorage.setItem('swachhmap_user', JSON.stringify(adminData));
      return { success: true, admin: adminData };
    }

    return { success: false, message: 'Invalid administrative credentials.' };
  };

  // Citizen Registration
  const register = async (name, email, password) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/register`, { name, email, password }, { timeout: 7000 });
      if (res.data.success && res.data.token) {
        const userData = res.data.user;
        setUser(userData);
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('swachhmap_user', JSON.stringify(userData));
        return { success: true, user: userData };
      }
    } catch (err) {
      if (err.response?.data?.message) {
        return { success: false, message: err.response.data.message };
      }
    }

    // Fallback registration
    const newUser = { id: 'citizen-' + Date.now(), name, email, role: 'citizen' };
    demoUsers.push({ ...newUser, password });
    setUser(newUser);
    localStorage.setItem('token', 'demo-jwt-token-' + newUser.id);
    localStorage.setItem('swachhmap_user', JSON.stringify(newUser));
    return { success: true, user: newUser };
  };

  const logout = () => {
    console.log('🚪 User logging out');
    setUser(null);
    localStorage.removeItem('swachhmap_user');
    localStorage.removeItem('token');
  };

  const isAdmin = Boolean(user && user.role === 'admin');

  return (
    <AuthContext.Provider value={{
      user,
      isAdmin,
      login,
      adminLogin,
      register,
      logout,
      loading,
      demoUsers
    }}>
      {children}
    </AuthContext.Provider>
  );
};
