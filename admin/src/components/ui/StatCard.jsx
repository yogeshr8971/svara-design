import React from 'react';

export default function StatCard({ title, value, icon: Icon, change, trend = 'neutral', className = '' }) {
  return (
    <div className={`glass-card p-6 flex flex-col justify-between hover:shadow-md transition-shadow ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">{title}</span>
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-ivory-100 flex items-center justify-center text-burgundy-600">
            <Icon size={20} />
          </div>
        )}
      </div>
      <div className="mt-4">
        <div className="font-display text-2xl font-bold text-charcoal-800">{value}</div>
        {change && (
          <div className="mt-1 flex items-center text-xs">
            <span
              className={`font-semibold ${
                trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-rose-600' : 'text-charcoal-400'
              }`}
            >
              {change}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
