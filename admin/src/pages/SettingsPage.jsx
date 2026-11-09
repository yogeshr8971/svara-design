import React, { useState, useEffect } from 'react';
import { Settings, DollarSign, Save, ShieldCheck } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Spinner from '../components/ui/Spinner';
import * as adminService from '../services/adminService';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const [commissionRate, setCommissionRate] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminService
      .getCommissionSettings()
      .then((res) => {
        setCommissionRate(res.settings?.commissionRate ?? 10);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSaveCommission = async (e) => {
    e.preventDefault();
    const rate = Number(commissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      return toast.error('Commission rate must be between 0% and 100%.');
    }

    try {
      setSaving(true);
      await adminService.updateCommissionSettings(rate);
      toast.success(`Platform commission rate updated to ${rate}%.`);
    } catch {
      toast.error('Failed to update platform settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-heading text-2xl font-bold">Platform Configuration & Policies</h1>
        <p className="text-xs text-charcoal-400 mt-0.5">
          Manage marketplace commission percentage, settlement rules, and atelier governance.
        </p>
      </div>

      <div className="glass-card p-6 max-w-xl space-y-6">
        <form onSubmit={handleSaveCommission} className="space-y-5 text-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-burgundy-600" />
              <h3 className="font-display text-base font-bold text-charcoal-800">
                Marketplace Commission Rate
              </h3>
            </div>
            <p className="text-xs text-charcoal-500">
              This percentage is automatically retained by SVARA from all partner merchant sales upon payment settlement.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-36">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                className="input-field py-2 pr-8 text-sm font-bold text-charcoal-800"
                required
              />
              <span className="absolute right-3 top-2.5 text-charcoal-400 font-bold">%</span>
            </div>
            <Button type="submit" variant="primary" size="sm" loading={saving}>
              <Save size={14} />
              <span>Update Commission</span>
            </Button>
          </div>
        </form>

        <div className="pt-4 border-t border-ivory-200 space-y-2">
          <div className="flex items-center gap-2 text-charcoal-700 font-bold">
            <ShieldCheck size={16} className="text-emerald-600" />
            <span>Active Safeguards Enforced</span>
          </div>
          <ul className="text-xs text-charcoal-500 list-disc list-inside space-y-1">
            <li>Strict 60-second expiry on verification codes</li>
            <li>Role-based backend checks for customer, seller, and administrator accounts</li>
            <li>3-Stage Order Lifecycle: Ordered → Shipped → Delivered</li>
            <li>Mandatory administrator shipping fee assignment prior to product checkout</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
