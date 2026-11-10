import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import OtpStep from '../components/auth/OtpStep';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_USER_CREDITS } from '../utils/constants';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(null); // { mode, email, maskedEmail }

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const done = () => {
    toast.success('Welcome back to SVARA');
    navigate(from, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Please fill in both email and password.');
    try {
      setLoading(true);
      const data = await login(email, password);
      if (data.user) return done();
      if (data.verificationRequired) setPending({ mode: 'register', ...data });
      else if (data.otpRequired) setPending({ mode: 'login', ...data });
    } catch (err) {
      toast.error(err.response?.data?.message || err.readableMessage || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md glass rounded-3xl p-8 sm:p-10 shadow-glass-lg space-y-8 border border-white/60">
        <div className="text-center space-y-2">
          <Link to="/" className="inline-block">
            <span className="font-display text-3xl font-bold tracking-widest text-charcoal-700">SVARA</span>
          </Link>
          <p className="text-xs uppercase tracking-widest text-charcoal-400 font-semibold">Wear Your Voice</p>
          {!pending && <h2 className="font-display text-xl font-semibold text-charcoal-700 pt-2">Sign in to your account</h2>}
        </div>

        {pending ? (
          <OtpStep {...pending} onSuccess={done} onBack={() => setPending(null)} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input label="Email Address" type="email" icon={Mail} placeholder="you@domain.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Password" type="password" icon={Lock} placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full justify-center">
              <span>Continue</span>
              <ArrowRight size={16} />
            </Button>
            <p className="text-center text-[11px] text-charcoal-400">We'll email you a one-time code to confirm it's you.</p>
            <div className="text-right"><Link to="/forgot-password" className="text-[11px] text-champagne-600 hover:underline font-medium">Forgot password?</Link></div>
          </form>
        )}

        {!pending && (
          <div className="text-center text-xs text-charcoal-500 pt-2 border-t border-ivory-300/40">
            <span>New to SVARA? </span>
            <Link to="/register" className="font-semibold text-champagne-500 hover:text-champagne-600">
              {DEFAULT_USER_CREDITS > 0
                ? `Create an account & get ${DEFAULT_USER_CREDITS} free AI credits`
                : 'Create an account'}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
