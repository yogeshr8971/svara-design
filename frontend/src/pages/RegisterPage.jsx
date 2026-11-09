import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Sparkles, ArrowRight, Smartphone } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import OtpStep from '../components/auth/OtpStep';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_USER_CREDITS } from '../utils/constants';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(null);
  const { register } = useAuth();
  const navigate = useNavigate();

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone || !form.password) return toast.error('Please complete all required fields.');
    if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, '').slice(-10))) return toast.error('Enter a valid 10-digit mobile number.');
    if (form.password !== form.confirmPassword) return toast.error('Passwords do not match.');
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters.');
    try {
      setLoading(true);
      const data = await register({ name: form.name, email: form.email, phone: form.phone, password: form.password });
      setPending({ mode: 'register', ...data });
      toast.success(data.message || 'Verification codes sent.');
    } catch (err) {
      toast.error(err.response?.data?.message || err.readableMessage || 'Registration failed');
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
          {DEFAULT_USER_CREDITS > 0 && (
            <div className="inline-flex items-center gap-1 text-[11px] font-bold text-champagne-500 uppercase tracking-wider bg-champagne-100/70 px-3 py-0.5 rounded-full">
              <Sparkles size={12} />
              <span>Includes {DEFAULT_USER_CREDITS} Free AI Credits</span>
            </div>
          )}
          {!pending && <h2 className="font-display text-xl font-semibold text-charcoal-700 pt-1">Create your profile</h2>}
        </div>

        {pending ? (
          <OtpStep
            {...pending}
            onBack={() => setPending(null)}
            onSuccess={() => {
              if (DEFAULT_USER_CREDITS > 0) {
                toast.success(`Welcome to SVARA! ${DEFAULT_USER_CREDITS} free AI credits have been added.`);
              } else {
                toast.success('Welcome to SVARA!');
              }
              navigate('/');
            }}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Full Name" icon={User} placeholder="Aaradhya Sharma" autoComplete="name" value={form.name} onChange={set('name')} required />
            <Input label="Email Address" type="email" icon={Mail} placeholder="you@domain.com" autoComplete="email" value={form.email} onChange={set('email')} required />
            <Input label="Mobile Number" type="tel" icon={Smartphone} placeholder="10-digit mobile number" autoComplete="tel-national" value={form.phone} onChange={set('phone')} required />
            <Input label="Password" type="password" icon={Lock} placeholder="At least 8 characters" autoComplete="new-password" value={form.password} onChange={set('password')} required />
            <Input label="Confirm Password" type="password" icon={Lock} placeholder="Confirm password" autoComplete="new-password" value={form.confirmPassword} onChange={set('confirmPassword')} required />
            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full justify-center mt-2">
              <span>Send verification codes</span>
              <ArrowRight size={16} />
            </Button>
            <p className="text-center text-[11px] text-charcoal-400">We'll verify your email and mobile number with one-time codes.</p>
          </form>
        )}

        {!pending && (
          <div className="text-center text-xs text-charcoal-500 pt-2 border-t border-ivory-300/40">
            <span>Already registered? </span>
            <Link to="/login" className="font-semibold text-champagne-500 hover:text-champagne-600">Sign in here</Link>
          </div>
        )}
      </div>
    </div>
  );
}
