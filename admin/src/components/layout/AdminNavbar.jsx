import React from 'react';
import { ExternalLink, Menu, LogOut } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';

export default function AdminNavbar({ onToggleMobileSidebar = () => {} }) {
  const { adminUser, logout } = useAdminAuth();

  return (
    <header className="h-16 bg-white border-b border-ivory-300 px-3 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-xs">
      {/* Left: Mobile Sidebar Toggle & Clean Brand */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile / Tablet Hamburger Toggle */}
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-2 -ml-1 rounded-xl text-charcoal-600 hover:text-charcoal-900 hover:bg-ivory-100 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center shrink-0"
          aria-label="Open sidebar navigation"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-burgundy-600 text-white flex items-center justify-center font-display font-bold text-sm shadow-xs shrink-0">
            S
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-display font-bold text-base sm:text-lg text-charcoal-800 tracking-wider">
              SVARA
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-burgundy-50 text-burgundy-700 border border-burgundy-200 shrink-0">
              Admin
            </span>
          </div>
        </div>
      </div>

      {/* Right: Quick actions, Admin profile & Signout */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Storefront Link */}
        <a
          href={import.meta.env.VITE_STOREFRONT_URL || 'https://svara-shop.vercel.app/'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-charcoal-600 hover:text-burgundy-600 hover:bg-ivory-100 transition-colors"
          title="Open Customer Storefront"
        >
          <ExternalLink size={14} className="shrink-0 text-charcoal-500" />
          <span className="hidden md:inline">Storefront</span>
        </a>

        <div className="h-4 w-px bg-ivory-300 hidden sm:block shrink-0" />

        {/* Admin Avatar & Name */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="w-8 h-8 rounded-full bg-burgundy-100 text-burgundy-700 flex items-center justify-center font-bold text-xs border border-burgundy-200 shrink-0"
            title={adminUser?.email || adminUser?.name || 'Admin'}
          >
            {adminUser?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <span className="hidden lg:block text-xs font-semibold text-charcoal-800 truncate max-w-[120px]">
            {adminUser?.name || 'Administrator'}
          </span>
        </div>

        {/* Sign Out Button in Navbar */}
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 transition-all duration-200 shrink-0 shadow-2xs"
          title="Sign out of Admin Portal"
          aria-label="Sign out"
        >
          <LogOut size={14} className="shrink-0" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
