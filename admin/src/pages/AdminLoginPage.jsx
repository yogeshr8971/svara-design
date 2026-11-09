import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, Mail, Lock, ShieldAlert, ArrowRight, Eye, EyeOff, Clock } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useAdminAuth } from '../context/AdminAuthContext';
import toast from 'react-hot-toast';

export default function AdminLoginPage() {
  const { login, verifyOtp, isAuthenticated } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(60);

  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  // Exact 60-second OTP countdown timer (§5)
  useEffect(() => {
    let timer;
    if (otpStep && otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown((c) => Math.max(0, c - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpStep, otpCountdown]);

  const handleInitialLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Enter your administrator credentials.');

    try {
      setLoading(true);
      const res = await login(email, password);
      if (res?.otpRequired) {
        setOtpStep(true);
        setOtpCountdown(60);
        toast.success('Sign-in code sent to your email. Expires in 60 seconds.');
      } else if (res?.user?.role === 'admin') {
        toast.success('Welcome back, Administrator.');
        navigate(from, { replace: true });
      } else {
        toast.error('Access denied. Administrator privileges required.');
      }
    } catch (err) {
      toast.error(err.readableMessage || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otpCountdown === 0) {
      return toast.error('Your code has expired. Request a new code.');
    }
    if (!otp || otp.length !== 6) {
      return toast.error('Enter the 6-digit verification code.');
    }

    try {
      setLoading(true);
      const res = await verifyOtp(email, otp);
      if (res?.user?.role === 'admin') {
        toast.success('Administrator authenticated.');
        navigate(from, { replace: true });
      } else {
        toast.error('Access denied. Administrator privileges required.');
      }
    } catch (err) {
      toast.error(err.readableMessage || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpCountdown > 0) return;
    try {
      setLoading(true);
      await login(email, password);
      setOtpCountdown(60);
      setOtp('');
      toast.success('New 60-second code dispatched to your email.');
    } catch (err) {
      toast.error(err.readableMessage || 'Could not resend verification code.');
    } finally {
      setLoading(false);
    }
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-ivory-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-burgundy-600 text-white flex items-center justify-center shadow-lg shadow-burgundy-600/30">
          <ShieldCheck size={28} />
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-charcoal-800">
          SVARA Atelier Portal
        </h2>
        <p className="text-xs text-charcoal-500 uppercase tracking-widest font-semibold">
          Restricted Administrator Access
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="glass-card py-8 px-6 sm:px-10 shadow-xl border border-ivory-300">
          {!otpStep ? (
            <form onSubmit={handleInitialLogin} className="space-y-5">
              <Input
                label="Administrator Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@svara.in"
                required
                autoComplete="email"
              />

              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-500">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="input-field pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-charcoal-400 hover:text-charcoal-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                loading={loading}
                className="w-full justify-center py-2.5"
              >
                <span>Authenticate Credentials</span>
                <ArrowRight size={15} />
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200">
                  <Clock size={13} />
                  <span>
                    {otpCountdown > 0
                      ? `Code expires in ${formatTimer(otpCountdown)}`
                      : 'Code has expired'}
                  </span>
                </div>
                <p className="text-xs text-charcoal-500 pt-1">
                  Enter the 6-digit verification code emailed to <strong>{email}</strong>.
                </p>
              </div>

              <div>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  className="input-field text-center text-2xl tracking-[0.5em] font-mono py-3 font-bold"
                  autoFocus
                  disabled={otpCountdown === 0}
                />
                {otpCountdown === 0 && (
                  <p className="text-xs text-rose-600 font-semibold mt-2 text-center">
                    Your code has expired. Request a new code.
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Button
                  type="submit"
                  variant="primary"
                  loading={loading}
                  disabled={otp.length !== 6 || otpCountdown === 0}
                  className="w-full justify-center py-2.5"
                >
                  Confirm & Sign In
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={otpCountdown > 0 || loading}
                    className="text-xs font-semibold text-burgundy-600 hover:text-burgundy-800 disabled:text-charcoal-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {otpCountdown > 0
                      ? `Resend available in ${otpCountdown}s`
                      : 'Request a new code'}
                  </button>
                </div>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep(false);
                      setOtp('');
                    }}
                    className="text-xs text-charcoal-400 hover:text-charcoal-600"
                  >
                    ← Sign in with a different account
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
