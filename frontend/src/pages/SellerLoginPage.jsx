import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Store, Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import OtpStep from '../components/auth/OtpStep';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function SellerLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(null);

  const { loginSeller } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/seller/dashboard';

  const finish = () => {
    toast.success('Welcome back to your Seller Studio');
    navigate(from, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      const data = await loginSeller(email, password);
      if (data.user) return finish();
      setPending({ mode: data.verificationRequired ? 'register' : 'login', ...data });
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.readableMessage ||
        'Unable to log in to Seller Studio';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (pending) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md glass rounded-3xl p-8 sm:p-10 shadow-glass-lg border border-white/60">
          <OtpStep {...pending} onSuccess={finish} onBack={() => setPending(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md glass rounded-3xl p-8 sm:p-10 shadow-glass-lg space-y-8 border border-white/60">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-burgundy-100/70 text-burgundy-600 text-xs font-semibold tracking-widest uppercase mb-1">
            <Store size={13} />
            Seller Studio
          </div>
          <h2 className="font-display text-2xl font-bold text-charcoal-700">
            Atelier Partner Login
          </h2>
          <p className="text-xs uppercase tracking-widest text-charcoal-400 font-semibold">
            Manage your boutique & catalog
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Partner Email"
            type="email"
            icon={Mail}
            placeholder="atelier@designhouse.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Password"
            type="password"
            icon={Lock}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            className="w-full justify-center"
          >
            <span>Access Seller Studio</span>
            <ArrowRight size={16} />
          </Button>
        </form>

        <div className="space-y-3 pt-2 border-t border-ivory-300/40 text-center text-xs text-charcoal-500">
          <div>
            <span>New designer or boutique? </span>
            <Link
              to="/seller/register"
              className="font-semibold text-burgundy-600 hover:text-burgundy-700"
            >
              Apply to Sell on SVARA
            </Link>
          </div>
          <div>
            <Link
              to="/login"
              className="text-charcoal-400 hover:text-charcoal-600"
            >
              ← Back to Customer Shopping Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
