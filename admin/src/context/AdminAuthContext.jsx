import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as adminService from '../services/adminService';

const AdminAuthContext = createContext();

export function AdminAuthProvider({ children }) {
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentAdmin = useCallback(async () => {
    try {
      const data = await adminService.getAdminMe();
      if (data?.user && data.user.role === 'admin') {
        setAdminUser(data.user);
        localStorage.setItem('svara_admin_user', JSON.stringify(data.user));
      } else {
        setAdminUser(null);
        localStorage.removeItem('svara_admin_user');
        localStorage.removeItem('svara_admin_token');
      }
    } catch {
      setAdminUser(null);
      localStorage.removeItem('svara_admin_user');
      localStorage.removeItem('svara_admin_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentAdmin();
  }, [fetchCurrentAdmin]);

  const login = async (email, password) => {
    const res = await adminService.adminLogin(email, password);
    if (res.token) localStorage.setItem('svara_admin_token', res.token);
    if (res.user && res.user.role === 'admin') {
      setAdminUser(res.user);
      localStorage.setItem('svara_admin_user', JSON.stringify(res.user));
    }
    return res;
  };

  const verifyOtp = async (email, otp) => {
    const res = await adminService.verifyAdminOtp(email, otp);
    if (res.token) localStorage.setItem('svara_admin_token', res.token);
    if (res.user && res.user.role === 'admin') {
      setAdminUser(res.user);
      localStorage.setItem('svara_admin_user', JSON.stringify(res.user));
    }
    return res;
  };

  const logout = async () => {
    try {
      await adminService.adminLogout();
    } catch {
      // Ignore
    }
    setAdminUser(null);
    localStorage.removeItem('svara_admin_user');
    localStorage.removeItem('svara_admin_token');
  };

  return (
    <AdminAuthContext.Provider
      value={{
        adminUser,
        loading,
        isAuthenticated: Boolean(adminUser && adminUser.role === 'admin'),
        login,
        verifyOtp,
        logout,
        refresh: fetchCurrentAdmin,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
