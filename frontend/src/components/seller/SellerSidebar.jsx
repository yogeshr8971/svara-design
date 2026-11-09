import React from 'react';
import { LayoutDashboard, Package, ShoppingBag, TrendingUp, Store } from 'lucide-react';

export default function SellerSidebar({ activeSection, onSelectSection }) {
  const sections = [
    { id: 'dashboard', label: 'Store Overview', icon: LayoutDashboard },
    { id: 'products', label: 'My Products', icon: Package },
    { id: 'orders', label: 'Customer Orders', icon: ShoppingBag },
    { id: 'sales', label: 'Sales & Revenue', icon: TrendingUp },
    { id: 'profile', label: 'Store Profile', icon: Store },
  ];

  return (
    <div className="glass rounded-3xl p-4 sm:p-6 space-y-2">
      <div className="pb-4 border-b border-ivory-300/40 mb-2 px-2">
        <p className="text-[10px] uppercase tracking-widest font-bold text-burgundy-500">Seller Studio</p>
        <h3 className="font-display text-lg font-bold text-charcoal-700">Marketplace</h3>
      </div>
      {sections.map((sec) => {
        const Icon = sec.icon;
        const isActive = activeSection === sec.id;
        return (
          <button
            key={sec.id}
            onClick={() => onSelectSection(sec.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-semibold tracking-wide transition-all ${
              isActive
                ? 'bg-charcoal-700 text-white shadow-sm'
                : 'text-charcoal-500 hover:bg-white/60 hover:text-charcoal-700'
            }`}
          >
            <Icon size={16} />
            <span>{sec.label}</span>
          </button>
        );
      })}
    </div>
  );
}
