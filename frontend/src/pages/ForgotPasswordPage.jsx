import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, KeyRound, Lock, AlertTriangle, ShieldCheck } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import * as authService from '../services/authService';
import toast from 'react-hot-toast';

// Must match backend OTP_TTL_MS = Math.max(3, Number(process.env.OTP_TTL_MINUTES) || 3) * 60 * 1000 (at least 3 minutes = 180s)
const CODE_EXPIRY_SECONDS = 180;
const RESEND_COOLDOWN_SECONDS = 180;

function formatCountdown(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Two-step forgot password page:
 * Step 1 — Enter email to receive 3-minute OTP
 * Step 2 — Enter OTP + new password to reset
 */
export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1 state
  const [email, setEmail] = useState('');
  const [sendingCode, setSendingCode] = useState(false);

  // Step 2 state
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  // Countdown timer state
  const [expiryCountdown, setExpiryCountdown] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const codeExpired = step === 2 && expiryCountdown === 0;

  useEffect(() => {
    if (expiryCountdown <= 0) return;
    const timer = setInterval(() => setExpiryCountdown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [expiryCountdown]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Step 1: Request OTP
  const handleRequestCode = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      setSendingCode(true);
      await authService.forgotPassword(email.trim());
      toast.success('Reset code sent to your email.');
      setStep(2);
      setExpiryCountdown(CODE_EXPIRY_SECONDS);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      // Avoid leaking whether an email is registered (account enumeration)
      toast.success('If an account exists for that email, a reset code was sent.');
      // Still advance to step 2 so the user can try the code if they received it
      setStep(2);
      setExpiryCountdown(CODE_EXPIRY_SECONDS);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } finally {
      setSendingCode(false);
    }
  };

  // Step 2: Resend OTP
  const handleResend = useCallback(async () => {
    try {
      await authService.forgotPassword(email.trim());
      toast.success('New code sent to your email.');
      setExpiryCountdown(CODE_EXPIRY_SECONDS);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setOtp('');
    } catch {
      toast.error('Could not resend the code. Please try again.');
    }
  }, [email]);

  // Step 2: Reset password
  const handleReset = async (e) => {
    e.preventDefault();
    if (!otp || !newPassword) return;
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    try {
      setResetting(true);
      await authService.resetPassword(email.trim(), otp, newPassword);
      toast.success('Password reset successfully! Please sign in.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reset password. The code may be invalid or expired.');
      setOtp('');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md glass rounded-3xl p-8 sm:p-10 shadow-xl border border-white/60 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-full bg-champagne-100 text-champagne-600 flex items-center justify-center">
            {step === 1 ? <KeyRound size={22} /> : <ShieldCheck size={22} />}
          </div>
          <h1 className="font-display text-2xl font-bold text-charcoal-700">
            {step === 1 ? 'Reset Password' : 'Enter Reset Code'}
          </h1>
          <p className="text-xs text-charcoal-400">
            {step === 1
              ? 'Enter your account email to receive a one-time reset code.'
              : `A 3-minute code was sent to ${email}. Enter it below.`}
          </p>
        </div>

        {step === 1 ? (
          /* ── Step 1: Email entry ── */
          <form onSubmit={handleRequestCode} className="space-y-5">
            <Input
              label="Your account email"
              type="email"
              icon={Mail}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={sendingCode}
              className="w-full justify-center"
            >
              Send Reset Code
            </Button>
          </form>
        ) : (
          /* ── Step 2: OTP + new password ── */
          <form onSubmit={handleReset} className="space-y-5">
            {/* Countdown */}
            {!codeExpired ? (
              <div className="text-center text-xs text-charcoal-500 space-x-1">
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

            {/* OTP */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase font-medium tracking-wider text-charcoal-400 flex items-center gap-1.5">
                <ShieldCheck size={13} /> Reset Code
              </label>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                disabled={codeExpired}
                className={`input-field text-center text-2xl tracking-[0.5em] font-mono ${
                  codeExpired ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={resendCooldown > 0}
                  onClick={handleResend}
                  className="text-[11px] font-semibold text-champagne-600 disabled:text-charcoal-300"
                >
                  {resendCooldown > 0 ? `Resend in ${formatCountdown(resendCooldown)}` : 'Resend code'}
                </button>
              </div>
            </div>

            {/* New Password */}
            <Input
              label="New Password"
              type="password"
              icon={Lock}
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={codeExpired}
              required
            />
            <Input
              label="Confirm New Password"
              type="password"
              icon={Lock}
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={codeExpired}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={resetting}
              disabled={otp.length !== 6 || !newPassword || codeExpired}
              className="w-full justify-center"
            >
              Reset Password
            </Button>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="block mx-auto text-xs text-charcoal-400 hover:text-charcoal-600"
            >
              ← Use a different email
            </button>
          </form>
        )}

        <p className="text-center text-xs text-charcoal-400">
          Remembered it?{' '}
          <Link to="/login" className="font-semibold text-champagne-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
