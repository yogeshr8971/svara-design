import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Circle, Copy, MapPin, Package, Truck, CreditCard } from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import UpiPaymentPanel from '../components/checkout/UpiPaymentPanel';
import { formatDate } from '../utils/formatDate';
import { formatPrice } from '../utils/formatPrice';
import { ORDER_STATUSES, PAYMENT_STATUSES, PAYMENT_METHOD_LABELS } from '../utils/constants';
import * as orderService from '../services/orderService';
import toast from 'react-hot-toast';

const STEPS = [
  { key: 'Ordered', label: 'Ordered' },
  { key: 'Shipped', label: 'Shipped' },
  { key: 'Delivered', label: 'Delivered' },
];

/** Rank canonical statuses case-insensitively */
const getRank = (status) => {
  if (!status) return -1;
  const s = status.toLowerCase();
  if (s === 'ordered') return 0;
  if (s === 'shipped') return 1;
  if (s === 'delivered') return 2;
  return -1;
};

/** Find timestamp for step from statusHistory (fallback to createdAt for Ordered) */
const getStepTimestamp = (order, stepKey) => {
  if (!order) return null;
  const history = order.statusHistory || [];
  const target = stepKey.toLowerCase();

  const entry = history.find((h) => {
    const s = (h.status || '').toLowerCase();
    if (target === 'ordered') {
      return s === 'ordered' || s === 'placed' || s === 'confirmed' || s === 'paid' || s === 'normalised';
    }
    return s === target;
  });

  if (entry?.at) return entry.at;
  if (target === 'ordered') return order.createdAt;
  return null;
};

export default function OrderTrackingPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await orderService.getOrder(id);
      setOrder(res.order);
    } catch {
      toast.error('Order not found.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Initial load
  useEffect(() => {
    load();
  }, [load]);

  // Real-time polling every 10s while tab visible and not Delivered/cancelled; refetch on focus
  useEffect(() => {
    if (!order) return;
    const normStatus = (order.orderStatus || '').toLowerCase();
    const isTerminal = normStatus === 'delivered' || normStatus === 'cancelled' || normStatus === 'refunded';
    if (isTerminal) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        load();
      }
    }, 10000);

    const handleFocus = () => {
      load();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [order?.orderStatus, load]);

  if (loading) return <div className="min-h-[60vh] grid place-items-center"><Spinner size="lg" /></div>;
  if (!order) return <div className="max-w-xl mx-auto py-24 text-center text-sm text-charcoal-400">We couldn't find that order. <Link to="/orders" className="underline">Back to orders</Link></div>;

  const statusLower = (order.orderStatus || '').toLowerCase();
  const cancelled = statusLower === 'cancelled' || statusLower === 'refunded';
  const current = getRank(order.orderStatus);
  const awaitingUpi = order.paymentMethod === 'upi' && statusLower === 'pending_payment';

  // Customer can cancel only while in pending_payment or Ordered, comparing case-insensitively
  const canCancel = ['pending_payment', 'ordered'].includes(statusLower) &&
    order.items.every((i) => ['ordered', 'cancelled'].includes((i.fulfillmentStatus || '').toLowerCase()));

  const cancel = async () => {
    if (!window.confirm('Cancel this order?')) return;
    try {
      await orderService.cancelOrder(order._id, 'Cancelled by customer');
      toast.success('Order cancelled.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not cancel.');
    }
  };

  const pay = PAYMENT_STATUSES[order.paymentStatus];
  const canonicalStatusKey = Object.keys(ORDER_STATUSES).find(
    (k) => k.toLowerCase() === statusLower
  ) || order.orderStatus;
  const statusMeta = ORDER_STATUSES[canonicalStatusKey];

  // Courier and tracking number for Shipped step
  const shippedItem = order.items?.find((i) => i.trackingNumber || i.courier);
  const courierName = shippedItem?.courier || '';
  const trackingNum = shippedItem?.trackingNumber || '';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Link to="/orders" className="inline-flex items-center gap-1 text-xs font-semibold text-charcoal-400 hover:text-charcoal-700">
        <ArrowLeft size={14} /> All orders
      </Link>

      <header className="glass rounded-3xl p-6 sm:p-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-bold text-champagne-600">Order tracking</p>
          <h1 className="font-display text-2xl font-bold text-charcoal-800 font-mono">#{order.orderNumber}</h1>
          <p className="text-xs text-charcoal-400 mt-1">Placed {formatDate(order.createdAt)} · {PAYMENT_METHOD_LABELS[order.paymentMethod]}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${statusMeta?.color || 'bg-ivory-200'}`}>
            {statusMeta?.label || order.orderStatus}
          </span>
          <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${pay?.color}`}>
            <CreditCard size={11} className="inline mr-1" />{pay?.label || order.paymentStatus}
          </span>
        </div>
      </header>

      {awaitingUpi && <UpiPaymentPanel order={order} onSubmitted={load} />}

      {order.paymentMethod === 'cod' && !cancelled && (
        <div className="glass rounded-2xl p-4 text-xs text-charcoal-600">
          Cash on Delivery — please keep <strong>{formatPrice(order.totalAmount)}</strong> ready. {order.paymentStatus === 'paid' ? 'Payment collected.' : 'Payment is collected upon delivery.'}
        </div>
      )}

      {/* 3 Steps Progress Tracker */}
      {!cancelled && statusLower !== 'pending_payment' && (
        <section className="glass rounded-3xl p-6 sm:p-8">
          <ol className="grid grid-cols-3 gap-2">
            {STEPS.map((s, i) => {
              const done = current >= i;
              const timestamp = getStepTimestamp(order, s.key);
              const isShippedStep = s.key === 'Shipped';

              return (
                <li key={s.key} className="flex flex-col items-center text-center gap-1.5 relative">
                  {i > 0 && (
                    <span className={`absolute top-4 right-1/2 w-full h-0.5 -z-0 ${current >= i ? 'bg-champagne-500' : 'bg-ivory-300'}`} />
                  )}
                  <span className={`relative z-10 w-8 h-8 rounded-full grid place-items-center ${done ? 'bg-champagne-500 text-white' : 'bg-ivory-300 text-charcoal-400'}`}>
                    {done ? <Check size={16} strokeWidth={3} /> : <Circle size={10} />}
                  </span>
                  <span className={`text-[11px] font-semibold ${done ? 'text-charcoal-700' : 'text-charcoal-300'}`}>{s.label}</span>
                  {timestamp && (
                    <span className="text-[10px] text-charcoal-400 leading-tight">
                      {formatDate(timestamp)}
                    </span>
                  )}
                  {isShippedStep && (courierName || trackingNum) && (
                    <div className="text-[10px] text-charcoal-500 font-mono mt-0.5">
                      {courierName && <span>{courierName}: </span>}
                      {trackingNum && <span>{trackingNum}</span>}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}
      {cancelled && <div className="rounded-2xl bg-red-50 text-red-700 text-sm p-4">This order was {order.orderStatus}. {order.cancelledReason}</div>}

      <div className="grid md:grid-cols-5 gap-6">
        <section className="md:col-span-3 glass rounded-3xl p-6 space-y-4">
          <h2 className="font-display font-bold text-charcoal-700 flex items-center gap-2"><Package size={16} /> Items</h2>
          {order.items.map((item) => (
            <div key={item._id} className="flex gap-3 text-xs">
              <img src={item.image} alt={item.name} className="w-14 h-[72px] object-cover rounded-xl bg-ivory-200" />
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-semibold text-charcoal-700 truncate">{item.name}</p>
                <p className="text-charcoal-400">Qty {item.quantity}{item.size && ` · ${item.size}`}{item.color && ` · ${item.color}`} · Sold by {item.sellerNameSnapshot}</p>
                <p className="text-[10px] uppercase font-bold text-champagne-700">{item.fulfillmentStatus}</p>
                {item.trackingNumber && (
                  <p className="text-charcoal-500 flex items-center gap-1"><Truck size={12} /> {item.courier}: <span className="font-mono">{item.trackingNumber}</span>
                    <button onClick={() => { navigator.clipboard?.writeText(item.trackingNumber); toast.success('Copied'); }} aria-label="Copy tracking number"><Copy size={11} /></button></p>
                )}
              </div>
              <span className="font-bold text-charcoal-700">{formatPrice(item.price * item.quantity)}</span>
            </div>
          ))}
          <div className="border-t border-ivory-300/40 pt-3 text-xs space-y-1 text-charcoal-500">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{order.shippingAmount ? formatPrice(order.shippingAmount) : 'Free'}</span></div>
            <div className="flex justify-between font-bold text-charcoal-800 text-sm"><span>Total</span><span>{formatPrice(order.totalAmount)}</span></div>
          </div>
        </section>

        <section className="md:col-span-2 space-y-6">
          <div className="glass rounded-3xl p-6 text-xs space-y-2">
            <h2 className="font-display font-bold text-charcoal-700 flex items-center gap-2 text-base"><MapPin size={16} /> Delivering to</h2>
            <p className="font-semibold text-charcoal-700">{order.shippingAddress.name}</p>
            <p className="text-charcoal-500">{order.shippingAddress.street}, {order.shippingAddress.city}, {order.shippingAddress.state} – {order.shippingAddress.pincode}</p>
            <p className="text-charcoal-400">{order.shippingAddress.phone}</p>
          </div>
          <div className="glass rounded-3xl p-6">
            <h2 className="font-display font-bold text-charcoal-700 mb-4 text-base">Timeline</h2>
            <ol className="space-y-4 border-l-2 border-ivory-300 ml-1.5">
              {[...(order.statusHistory || [])].reverse().map((h, i) => (
                <li key={h._id || i} className="pl-4 relative">
                  <span className={`absolute -left-[7px] top-1 w-3 h-3 rounded-full ${i === 0 ? 'bg-champagne-500' : 'bg-charcoal-200'}`} />
                  <p className="text-xs font-semibold text-charcoal-700 capitalize">{(ORDER_STATUSES[h.status]?.label || h.status).toString()}</p>
                  {h.note && <p className="text-[11px] text-charcoal-500">{h.note}</p>}
                  <p className="text-[10px] text-charcoal-300">{formatDate(h.at)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>

      {canCancel && <div className="text-right"><Button variant="outline" size="sm" onClick={cancel}>Cancel order</Button></div>}
    </div>
  );
}
