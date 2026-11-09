import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './components/layout/AdminLayout';
import Spinner from './components/ui/Spinner';

// ── Lazy-loaded admin pages (code-split per route for faster initial load) ──
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ApprovalsPage = lazy(() => import('./pages/ApprovalsPage'));
const CatalogPage = lazy(() => import('./pages/CatalogPage'));
const SellersPage = lazy(() => import('./pages/SellersPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const SettlementReportsPage = lazy(() => import('./pages/SettlementReportsPage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const ExcelImportPage = lazy(() => import('./pages/ExcelImportPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const VtoLogsPage = lazy(() => import('./pages/VtoLogsPage'));
const ReviewsModerationPage = lazy(() => import('./pages/ReviewsModerationPage'));

// ── Suspense fallback ──
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Spinner size="lg" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<AdminLoginPage />} />
        <Route path="/" element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="sellers" element={<SellersPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="settlements" element={<SettlementReportsPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="excel-import" element={<ExcelImportPage />} />
          <Route path="vto-logs" element={<VtoLogsPage />} />
          <Route path="reviews" element={<ReviewsModerationPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
