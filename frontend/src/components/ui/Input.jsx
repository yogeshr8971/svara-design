import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Reusable Input component.
 * Automatically shows a password visibility toggle when type="password".
 */
export default function Input({
  label,
  error,
  icon: Icon,
  className = '',
  id,
  type,
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-xs uppercase font-medium tracking-wider text-charcoal-400">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3.5 text-charcoal-400 pointer-events-none">
            <Icon size={18} />
          </div>
        )}
        <input
          id={id}
          type={inputType}
          className={`input-field ${Icon ? 'pl-10' : ''} ${isPassword ? 'pr-10' : ''} ${
            error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200' : ''
          } ${className}`}
          {...props}
        />
        {/* Password visibility toggle */}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 text-charcoal-400 hover:text-charcoal-600 transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error && <span className="text-xs text-burgundy-500 font-medium">{error}</span>}
    </div>
  );
}
