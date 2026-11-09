import React, { useState } from 'react';
import { Mail, Phone, MapPin, Instagram, Send, Sparkles, Clock, CheckCircle } from 'lucide-react';
import SvaraBox from '../components/about/SvaraBox';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  // Business / Social data from env or defaults (never hard-code exclusively in component)
  const contactInfo = {
    email: import.meta.env.VITE_CONTACT_EMAIL || 'concierge@svara.fashion',
    phone: import.meta.env.VITE_CONTACT_PHONE || '+91 (0) 80 4567 8900',
    address: import.meta.env.VITE_ATELIER_ADDRESS || 'SVARA Atelier, Indiranagar, Bengaluru, Karnataka 560038',
    instagramUrl: import.meta.env.VITE_INSTAGRAM_URL || 'https://instagram.com/svara.fashion',
    hours: 'Monday – Saturday: 10:00 AM – 7:00 PM IST',
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast.error('Please complete all required fields.');
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSent(true);
      toast.success('Your message has been sent to our concierge.');
      setForm({ name: '', email: '', subject: '', message: '' });
    }, 600);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-20">
      {/* 1. Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-champagne-100 text-champagne-700 text-xs font-semibold tracking-widest uppercase">
          <Sparkles size={13} />
          Concierge & Atelier
        </span>
        <h1 className="section-heading text-3xl sm:text-4xl lg:text-5xl font-bold">
          Get in Touch
        </h1>
        <p className="text-xs sm:text-sm text-charcoal-400 leading-relaxed">
          Whether you seek bespoke styling advice, assistance with your AI Virtual Try-On, or wish to partner as an atelier designer — our team is here for you.
        </p>
      </div>

      {/* 2. Interactive 3D SvaraBox Experience (Moved from HomePage per Rule 50) */}
      <section className="glass rounded-3xl p-6 sm:p-10 border border-white/60 shadow-glass-lg relative overflow-hidden">
        <div className="text-center mb-2">
          <span className="text-[10px] uppercase font-bold tracking-widest text-champagne-600 block">
            Signature Experience
          </span>
        </div>
        <SvaraBox />
      </section>

      {/* 3. Contact Grid: Info Cards + Inquiry Form */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        {/* Contact Info Card */}
        <div className="lg:col-span-2 glass rounded-3xl p-8 border border-white/60 shadow-glass space-y-6">
          <div>
            <h2 className="font-display text-xl font-bold text-charcoal-700">
              SVARA Concierge
            </h2>
            <p className="text-xs text-charcoal-400 mt-1">
              Direct assistance for patrons and partners
            </p>
          </div>

          <div className="space-y-4 text-xs text-charcoal-600">
            <div className="flex items-start gap-3">
              <Mail size={16} className="text-champagne-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-charcoal-700">Email</span>
                <a href={`mailto:${contactInfo.email}`} className="text-champagne-600 hover:underline">
                  {contactInfo.email}
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone size={16} className="text-champagne-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-charcoal-700">Telephone</span>
                <span>{contactInfo.phone}</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin size={16} className="text-champagne-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-charcoal-700">Flagship Atelier</span>
                <span>{contactInfo.address}</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock size={16} className="text-champagne-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-charcoal-700">Hours of Operation</span>
                <span>{contactInfo.hours}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-ivory-300/40">
            <span className="font-semibold block text-xs text-charcoal-700 mb-2">Connect on Instagram</span>
            <a
              href={contactInfo.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 text-white text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
            >
              <Instagram size={14} />
              <span>@svara.fashion</span>
            </a>
          </div>
        </div>

        {/* Inquiry Form */}
        <div className="lg:col-span-3 glass rounded-3xl p-8 border border-white/60 shadow-glass space-y-6">
          <div>
            <h2 className="font-display text-xl font-bold text-charcoal-700">
              Send an Inquiry
            </h2>
            <p className="text-xs text-charcoal-400 mt-1">
              We respond to all concierge messages within 24 hours
            </p>
          </div>

          {sent ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle size={24} />
              </div>
              <h3 className="font-display text-lg font-bold text-charcoal-700">Message Received</h3>
              <p className="text-xs text-charcoal-400 max-w-sm mx-auto">
                Thank you for contacting SVARA. One of our stylists will get in touch shortly.
              </p>
              <Button variant="outline" size="sm" onClick={() => setSent(false)}>
                Send Another Message
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Your Name"
                  placeholder="e.g. Radhika Menon"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="radhika@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>

              <Input
                label="Subject"
                placeholder="Virtual Try-On assistance, bespoke inquiry, or order help"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />

              <div>
                <label className="text-xs uppercase font-medium text-charcoal-400 mb-1 block">
                  Message
                </label>
                <textarea
                  rows={4}
                  className="input-field py-2 text-xs w-full"
                  placeholder="How can we assist you today?"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  required
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                loading={submitting}
                className="w-full justify-center py-3"
              >
                <Send size={15} />
                <span>Transmit Inquiry</span>
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
