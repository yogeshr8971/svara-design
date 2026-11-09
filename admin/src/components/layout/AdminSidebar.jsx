import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Store,
  Clock,
  Package,
  ShoppingBag,
  DollarSign,
  Users,
  FileSpreadsheet,
  FolderTree,
  Sparkles,
  MessageSquare,
  Settings,
  LogOut,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';

export default function AdminSidebar({ pendingApprovalsCount = 0, mobileOpen = false, onClose = () => {} }) {
  const { adminUser, logout } = useAdminAuth();

  const navItems = [
    { to: '/', label: 'Dashboard Overview', icon: LayoutDashboard },
    { to: '/approvals', label: 'Pending Approvals', icon: Clock, badge: pendingApprovalsCount },
    { to: '/catalog', label: 'Catalog & Stock', icon: Package },
    { to: '/sellers', label: 'Sellers Directory', icon: Store },
    { to: '/orders', label: 'Orders & Fulfillment', icon: ShoppingBag },
    { to: '/settlements', label: 'Settlement & Sales', icon: DollarSign },
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/categories', label: 'Shopping Stages', icon: FolderTree },
    { to: '/excel-import', label: 'Excel Bulk Import', icon: FileSpreadsheet },
    { to: '/vto-logs', label: 'AI Virtual Try-On', icon: Sparkles },
    { to: '/reviews', label: 'Product Reviews', icon: MessageSquare },
    { to: '/settings', label: 'Platform Settings', icon: Settings },
  ];

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full p-4">
      <div className="space-y-6">
        {/* Brand header */}
        <div className="px-3 py-3 border-b border-charcoal-600/60 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-xl font-bold tracking-widest text-ivory-50">SVARA</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-burgundy-500 text-white">
                Admin
              </span>
            </div>
            <p className="text-[10px] text-charcoal-300 mt-0.5">Marketplace Executive Control</p>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-champagne-400" />
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-1 rounded-lg text-charcoal-300 hover:text-white hover:bg-charcoal-600"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all min-h-[44px] ${
                  isActive
                    ? 'bg-burgundy-600 text-white shadow-xs'
                    : 'text-charcoal-200 hover:bg-charcoal-600/70 hover:text-white'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <item.icon size={16} />
                <span>{item.label}</span>
              </div>
              {Boolean(item.badge && item.badge > 0) && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-charcoal-900 shadow-xs">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Admin user footer */}
      <div className="pt-4 border-t border-charcoal-600/60 space-y-3">
        <div className="px-3 flex items-center justify-between">
          <div className="truncate">
            <p className="text-xs font-bold text-ivory-50 truncate">{adminUser?.name || 'Administrator'}</p>
            <p className="text-[10px] text-charcoal-300 truncate">{adminUser?.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onClose();
            logout();
          }}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-charcoal-600 hover:bg-rose-900/40 text-charcoal-200 hover:text-rose-300 text-xs font-semibold transition-colors min-h-[44px]"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop static sidebar */}
      <aside className="hidden lg:flex w-64 bg-charcoal-700 text-charcoal-100 min-h-screen flex-col shrink-0 shadow-xl border-r border-charcoal-800">
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-charcoal-900/60 backdrop-blur-sm transition-opacity"
            onClick={onClose}
          />
          <div className="relative w-64 max-w-[85vw] bg-charcoal-700 text-charcoal-100 min-h-screen shadow-2xl flex flex-col z-10">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
