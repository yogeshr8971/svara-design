import React from 'react';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  onClick,
  ...props
}) {
  const base =
    'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';

  const sizes = {
    xs: 'px-2.5 py-1 text-xs gap-1',
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2',
  };

  const variants = {
    primary: 'bg-burgundy-600 hover:bg-burgundy-700 text-white shadow-sm hover:shadow active:scale-[0.98]',
    secondary: 'bg-ivory-200 hover:bg-ivory-300 text-charcoal-700 active:scale-[0.98]',
    outline: 'border border-ivory-300 hover:bg-ivory-100 text-charcoal-700 active:scale-[0.98]',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white active:scale-[0.98]',
    ghost: 'hover:bg-ivory-100 text-charcoal-600 hover:text-charcoal-800',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98]',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${base} ${sizes[size] || sizes.md} ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : null}
      {children}
    </button>
  );
}
