import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Store, ShieldCheck, Sparkles, Clock, CheckCircle } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import OtpStep from '../components/auth/OtpStep';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function SellerRegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    businessName: '',
    businessAddress: '',
    gstNumber: '',
    sellerDescription: '',
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(null);

  const { registerSeller } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.businessName.trim()) {
      return toast.error('Business Name is required for seller registration.');
    }
    try {
      setLoading(true);
      if (!/^[6-9]\d{9}$/.test(formData.phone.replace(/\D/g, '').slice(-10))) {
        return toast.error('Enter a valid 10-digit mobile number.');
      }
      if (formData.password.length < 8) return toast.error('Password must be at least 8 characters.');
      const data = await registerSeller(formData);
      setPending({ mode: 'register', ...data });
      toast.success(data.message || 'Verification codes sent.');
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.readableMessage ||
          'Registration failed. Please check your details.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (pending && !submitted) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="glass rounded-3xl p-8 border border-white/60">
          <OtpStep
            {...pending}
            onBack={() => setPending(null)}
            onSuccess={() => { setSubmitted(true); toast.success('Verified! Application submitted for review.'); }}
          />
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-champagne-100 flex items-center justify-center text-champagne-600">
          <Clock size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold text-charcoal-700">
            Application Under Review
          </h1>
          <p className="text-xs text-charcoal-500 max-w-md mx-auto leading-relaxed">
            Thank you for applying to sell on SVARA. Our curation team reviews
            all atelier applications within 24-48 business hours to ensure
            curatorial excellence.
          </p>
        </div>
        <div className="glass p-6 rounded-2xl border border-white/60 space-y-3 text-left text-xs text-charcoal-600">
          <div className="font-semibold text-charcoal-700 border-b pb-2">
            What happens next?
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
            <span>1. Our team verifies your store identity and product catalog suitability.</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
            <span>2. You receive an activation confirmation once approved.</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
            <span>3. Log in to your Seller Studio to upload and manage designs.</span>
          </div>
        </div>
        <div className="flex justify-center gap-4 pt-4">
          <Button variant="outline" onClick={() => navigate('/seller/login')}>
            Go to Seller Login
          </Button>
          <Button variant="primary" onClick={() => navigate('/')}>
            Explore SVARA
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <div className="text-center mb-8 space-y-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-burgundy-100/70 text-burgundy-600 text-xs font-semibold tracking-widest uppercase">
          <Store size={13} />
          Partner with SVARA
        </span>
        <h1 className="section-heading text-3xl font-bold">Become an Atelier Seller</h1>
        <p className="text-xs text-charcoal-400 max-w-md mx-auto">
          Showcase your luxury designs to discerning clientele with AI Virtual Try-On experiences.
        </p>
      </div>

      <div className="glass rounded-3xl p-6 sm:p-8 border border-white/60 shadow-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Contact Representative Name"
              name="name"
              placeholder="e.g. Priya Sharma"
              value={formData.name}
              onChange={handleChange}
              required
            />
            <Input
              label="Contact Email"
              type="email"
              name="email"
              placeholder="priya@designhouse.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Account Password"
              type="password"
              name="password"
              placeholder="Minimum 8 characters"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <Input
              label="Mobile Number"
              name="phone"
              type="tel"
              placeholder="10-digit mobile number"
              value={formData.phone}
              onChange={handleChange}
              required
            />
          </div>

          <div className="pt-4 border-t border-ivory-300/40">
            <h3 className="text-xs uppercase font-bold tracking-wider text-charcoal-400 mb-3">Store Information</h3>
            <div className="space-y-4">
              <Input
                label="Brand / Store Name"
                name="businessName"
                placeholder="e.g. Saffron Silk Couture"
                value={formData.businessName}
                onChange={handleChange}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="GST / Tax Number (Optional)"
                  name="gstNumber"
                  placeholder="22AAAAA0000A1Z5"
                  value={formData.gstNumber}
                  onChange={handleChange}
                />
                <Input
                  label="Registered Address (Optional)"
                  name="businessAddress"
                  placeholder="Mumbai, Maharashtra"
                  value={formData.businessAddress}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="text-xs uppercase font-medium text-charcoal-400 mb-1 block">Brand Bio</label>
                <textarea
                  name="sellerDescription"
                  rows={3}
                  className="input-field py-2 text-xs w-full"
                  placeholder="Tell clients about your aesthetic, craftsmanship, and materials..."
                  value={formData.sellerDescription}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-ivory-200/40 border border-ivory-300/40 flex items-start gap-3">
            <ShieldCheck size={18} className="text-champagne-600 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-charcoal-500 leading-relaxed">
              <strong>Application Process:</strong> All seller applications are reviewed by SVARA Admin for catalog quality. Once approved, your store will become active and you can publish products immediately.
            </div>
          </div>

          <Button type="submit" variant="primary" loading={loading} className="w-full justify-center py-3">
            <Sparkles size={16} />
            <span>Submit Seller Application</span>
          </Button>

          <p className="text-center text-xs text-charcoal-400 pt-2">
            Already registered?{' '}
            <Link to="/seller/login" className="text-champagne-600 font-semibold hover:underline">
              Log in to Seller Studio
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
