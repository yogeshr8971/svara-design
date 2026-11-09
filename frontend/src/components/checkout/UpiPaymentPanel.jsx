import React, { useEffect, useState } from 'react';
import { Copy, Smartphone, ShieldCheck } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { formatPrice } from '../../utils/formatPrice';
import * as orderService from '../../services/orderService';
import toast from 'react-hot-toast';

/**
 * Direct UPI: customer pays our UPI ID from any UPI app, then enters the 12-digit UTR.
 * An admin matches it against the bank/UPI statement and releases the order.
 */
export default function UpiPaymentPanel({ order, onSubmitted }) {
  const [details, setDetails] = useState(null);
  const [utr, setUtr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    orderService.getUpiDetails(order._id).then((d) => setDetails(d.upi)).catch(() => toast.error('Could not load UPI details.'));
  }, [order._id]);

  const submitted = Boolean(order.upi?.utr);
  const copy = (text, label) => { navigator.clipboard?.writeText(text); toast.success(`${label} copied`); };

  const submit = async (e) => {
    e.preventDefault();
    try {
      setBusy(true);
      await orderService.submitUpiPayment(order._id, utr.trim());
      toast.success('Reference received — we\u2019re verifying your payment.');
      onSubmitted?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit the reference.');
    } finally { setBusy(false); }
  };

  if (submitted) {
    return (
      <div className="glass rounded-3xl p-6 border border-blue-200 bg-blue-50/60 text-sm text-charcoal-700">
        <p className="font-semibold">Verifying your UPI payment</p>
        <p className="text-xs text-charcoal-500 mt-1">UTR <span className="font-mono">{order.upi.utr}</span> submitted. We'll notify you the moment it's confirmed.</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl p-6 sm:p-8 space-y-5">
      <div className="flex items-center gap-2 font-display font-bold text-charcoal-700"><Smartphone size={18} /> Pay {formatPrice(order.totalAmount)} with UPI</div>
      {order.upi?.rejectionReason && <p className="text-xs rounded-xl bg-red-50 text-red-700 p-3">Previous payment couldn't be verified: {order.upi.rejectionReason}</p>}
      {details && (
        <>
          <a href={details.deepLink} className="block md:hidden">
            <Button variant="primary" size="lg" className="w-full justify-center">Open UPI app to pay</Button>
          </a>
          <div className="rounded-2xl bg-white/70 p-4 text-xs space-y-2">
            <div className="flex justify-between items-center"><span className="text-charcoal-400">Pay to (UPI ID)</span>
              <button onClick={() => copy(details.vpa, 'UPI ID')} className="font-mono font-semibold text-charcoal-800 flex items-center gap-1.5">{details.vpa}<Copy size={12} /></button></div>
            <div className="flex justify-between"><span className="text-charcoal-400">Payee</span><span className="font-semibold">{details.payeeName}</span></div>
            <div className="flex justify-between items-center"><span className="text-charcoal-400">Amount</span>
              <button onClick={() => copy(String(details.amount), 'Amount')} className="font-semibold flex items-center gap-1.5">₹{details.amount}<Copy size={12} /></button></div>
            <div className="flex justify-between"><span className="text-charcoal-400">Note</span><span className="font-mono">Order {order.orderNumber}</span></div>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <Input label="12-digit UPI reference (UTR)" inputMode="numeric" maxLength={12} placeholder="e.g. 412345678901" value={utr} onChange={(e) => setUtr(e.target.value.replace(/\D/g, ''))} required />
            <Button type="submit" variant="primary" loading={busy} disabled={utr.length !== 12} className="w-full justify-center">I've paid — submit reference</Button>
          </form>
          <p className="text-[11px] text-charcoal-400 flex items-center gap-1.5"><ShieldCheck size={13} /> Pay the exact amount. Your order is held for a limited time while you complete the payment.</p>
        </>
      )}
    </div>
  );
}
