import React from 'react';

export default function Badge({ children, variant = 'neutral', size = 'sm', className = '' }) {
  const variants = {
    neutral: 'bg-ivory-200 text-charcoal-700',
    primary: 'bg-burgundy-100 text-burgundy-700',
    success: 'bg-emerald-100 text-emerald-800',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-rose-100 text-rose-800',
    info: 'bg-blue-100 text-blue-800',
  };

  const sizes = {
    xs: 'px-2 py-0.5 text-[10px]',
    sm: 'px-2.5 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center font-bold uppercase tracking-wider rounded-full ${
        variants[variant] || variants.neutral
      } ${sizes[size] || sizes.sm} ${className}`}
    >
      {children}
    </span>
  );
}
