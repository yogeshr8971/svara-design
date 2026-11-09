import React, { useState, useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminNavbar from './AdminNavbar';
import Spinner from '../ui/Spinner';
import { useAdminAuth } from '../../context/AdminAuthContext';
import * as adminService from '../../services/adminService';

export default function AdminLayout() {
  const { adminUser, loading, isAuthenticated } = useAdminAuth();
  const location = useLocation();
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (isAuthenticated) {
      adminService
        .getAdminProducts({ status: 'pending', limit: 1 })
        .then((res) => {
          if (res?.pendingCount !== undefined) {
            setPendingApprovalsCount(res.pendingCount);
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ivory-50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="flex min-h-screen bg-ivory-50 text-charcoal-700">
      <AdminSidebar
        pendingApprovalsCount={pendingApprovalsCount}
        mobileOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminNavbar
          onToggleMobileSidebar={() => setMobileSidebarOpen((prev) => !prev)}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
          <Outlet context={{ refreshPendingCount: () => {} }} />
        </main>
      </div>
    </div>
  );
}
