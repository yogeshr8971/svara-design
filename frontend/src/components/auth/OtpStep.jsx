import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mail, ShieldCheck, AlertTriangle } from 'lucide-react';
import Button from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import * as authService from '../../services/authService';
import toast from 'react-hot-toast';

// Must match backend OTP_TTL_MS = Math.max(3, OTP_TTL_MINUTES || 3) * 60 * 1000 (≥ 3 minutes = 180 seconds)
const CODE_EXPIRY_SECONDS = 180;
const RESEND_COOLDOWN_SECONDS = 180;

/**
 * Formats remaining seconds as MM:SS string, e.g. 125 → "02:05"
 */
function formatCountdown(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * A single-code input field with:
 * - 3-minute (180-second) expiry countdown
 * - Disabled submission when expired
 * - Expired message and resend button
 */
function CodeInput({ value, onChange, label, icon: Icon, hint, onResend, resendCooldown, isExpired }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs uppercase font-medium tracking-wider text-charcoal-400 flex items-center gap-1.5">
        <Icon size={13} /> {label}
      </label>
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="••••••"
        disabled={isExpired}
        className={`input-field text-center text-2xl tracking-[0.5em] font-mono ${
          isExpired ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        aria-label={label}
      />
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-charcoal-400">{hint}</span>
        <button
          type="button"
          disabled={resendCooldown > 0}
          onClick={onResend}
          className="font-semibold text-champagne-600 disabled:text-charcoal-300"
        >
          {resendCooldown > 0 ? `Resend in ${formatCountdown(resendCooldown)}` : 'Resend code'}
        </button>
      </div>
    </div>
  );
}

/**
 * OtpStep — handles email code verification for login and registration.
 *
 * mode 'login'    → one email code
 * mode 'register' → one email code (phone/SMS step removed)
 *
 * Each code expires after 3 minutes (180 seconds), enforced server-side.
 * Resend is available after the 3-minute backend cooldown.
 */
export default function OtpStep({ mode, email, maskedEmail, onSuccess, onBack }) {
  const { verifyLogin, verifyRegistration } = useAuth();

  const [emailOtp, setEmailOtp] = useState('');
  const [loading, setLoading] = useState(false);

  // Countdown until the code expires (starts at 180 — 3 minutes)
  const [expiryCountdown, setExpiryCountdown] = useState(CODE_EXPIRY_SECONDS);

  // Resend cooldown: 3 minutes after send/resend
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  const codeExpired = expiryCountdown === 0;

  // Tick down the expiry countdown every second
  useEffect(() => {
    if (expiryCountdown <= 0) return;
    const timer = setInterval(() => {
      setExpiryCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [expiryCountdown]);

  // Tick down the resend cooldown separately
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleResend = useCallback(async () => {
    try {
      if (mode === 'login') {
        await authService.resendLoginOtp(email);
      } else {
        await authService.resendRegistrationOtp(email);
      }
      toast.success('New code sent to your email.');
      // Reset expiry countdown and apply the 3-minute resend cooldown
      setExpiryCountdown(CODE_EXPIRY_SECONDS);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setEmailOtp('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not resend the code.');
    }
  }, [mode, email]);

  const canSubmit = emailOtp.length === 6 && !codeExpired;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      setLoading(true);
      if (mode === 'login') {
        const data = await verifyLogin(email, emailOtp);
        onSuccess?.(data);
      } else {
        const data = await verifyRegistration({ email, emailOtp });
        onSuccess?.(data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed. Please try again.');
      setEmailOtp('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 mx-auto rounded-full bg-champagne-100 text-champagne-600 flex items-center justify-center">
          <ShieldCheck size={22} />
        </div>
        <h2 className="font-display text-xl font-semibold text-charcoal-700">
          {mode === 'login' ? "Confirm it's you" : 'Verify your email'}
        </h2>
        <p className="text-xs text-charcoal-400">
          Enter the 6-digit code we emailed you.
        </p>
      </div>

      {/* Expiry Countdown */}
      {!codeExpired ? (
        <div className="flex items-center justify-center gap-2 text-xs text-charcoal-500">
          <span className="font-mono font-bold text-champagne-700 text-sm">
            {formatCountdown(expiryCountdown)}
          </span>
          <span>Code expires in</span>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 text-xs text-rose-600 bg-rose-50 px-4 py-2 rounded-xl">
          <AlertTriangle size={14} />
          <span>Your code has expired. Request a new code below.</span>
        </div>
      )}

      {/* Email Code Input */}
      <CodeInput
        value={emailOtp}
        onChange={setEmailOtp}
        label="Email code"
        icon={Mail}
        hint={`Sent to ${maskedEmail || email}`}
        onResend={handleResend}
        resendCooldown={resendCooldown}
        isExpired={codeExpired}
      />

      {/* Submit */}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={loading}
        disabled={!canSubmit}
        className="w-full justify-center"
      >
        {mode === 'login' ? 'Verify & Sign In' : 'Verify & Create Account'}
      </Button>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="block mx-auto text-xs text-charcoal-400 hover:text-charcoal-600"
        >
          ← Use a different account
        </button>
      )}

      {mode === 'login' && (
        <p className="text-center text-[11px] text-charcoal-400">
          You'll stay signed in on this device until you log out.
        </p>
      )}
    </form>
  );
}
