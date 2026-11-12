import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Package, ArrowRight, ExternalLink, MapPin, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import Spinner from '../components/ui/Spinner';
import Skeleton from '../components/ui/Skeleton';
import Button from '../components/ui/Button';
import { formatDate } from '../utils/formatDate';
import { formatPrice } from '../utils/formatPrice';
import { ORDER_STATUSES, PAYMENT_STATUSES, PAYMENT_METHOD_LABELS } from '../utils/constants';
import * as orderService from '../services/orderService';

/** Normalise any raw or legacy order status to a canonical key */
const resolveStatus = (raw) => {
  if (!raw) return 'pending_payment';
  const s = raw.toLowerCase();
  if (['ordered', 'placed', 'confirmed', 'paid', 'processing'].includes(s)) return 'Ordered';
  if (s === 'shipped') return 'Shipped';
  if (s === 'delivered') return 'Delivered';
  if (s === 'cancelled') return 'cancelled';
  if (s === 'pending_payment') return 'pending_payment';
  return 'pending_payment';
};

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const sentinelRef = useRef(null);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const res = await orderService.getOrders({ page: 1, limit: 10 });
        if (isMounted) {
          setOrders(res.orders || []);
          setHasMore(Boolean(res.hasMore));
          setPage(1);
        }
      } catch (err) {
        console.error('Error fetching orders:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchOrders();
    return () => {
      isMounted = false;
    };
  }, []);

  const loadNextPage = useCallback(async () => {
    if (isFetchingRef.current || !hasMore || loading || loadingMore) return;
    isFetchingRef.current = true;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await orderService.getOrders({ page: nextPage, limit: 10 });
      setOrders((prev) => {
        const existingIds = new Set(prev.map((o) => o._id));
        const newOrders = (res.orders || []).filter((o) => !existingIds.has(o._id));
        return [...prev, ...newOrders];
      });
      setHasMore(Boolean(res.hasMore));
      setPage(nextPage);
    } catch (err) {
      console.error('Error fetching next page of orders:', err);
    } finally {
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [hasMore, loading, loadingMore, page]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadNextPage();
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadNextPage, hasMore, loading, loadingMore]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <span className="text-xs font-bold uppercase tracking-widest text-burgundy-500">Purchase History</span>
        <h1 className="section-heading text-3xl font-bold">My Orders</h1>
        <p className="text-xs text-charcoal-400 mt-1">Review past orders, view purchased items, and track deliveries</p>
      </div>

      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="glass rounded-3xl p-6 sm:p-8 space-y-6 border border-white/60 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ivory-300/40 pb-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
              </div>
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="glass rounded-3xl p-16 text-center max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-champagne-100 text-champagne-600 flex items-center justify-center mx-auto">
            <Package size={28} />
          </div>
          <h3 className="font-display text-xl font-bold text-charcoal-700">No orders placed yet</h3>
          <p className="text-xs text-charcoal-400 leading-relaxed">
            Discover our designer collections or try our curated step-by-step shopping experience.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link to="/curate">
              <Button variant="primary" size="md">
                <span>Curate Look</span>
                <ArrowRight size={16} />
              </Button>
            </Link>
            <Link to="/shop">
              <Button variant="outline" size="md">
                <span>Shop All</span>
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const canonicalKey = resolveStatus(order.orderStatus);
            const statusMeta = ORDER_STATUSES[canonicalKey];
            const payMeta = PAYMENT_STATUSES[order.paymentStatus];
            const isPendingUpi = (order.orderStatus || '').toLowerCase() === 'pending_payment' && order.paymentMethod === 'upi';

            return (
              <div key={order._id} className="glass rounded-3xl p-6 sm:p-8 space-y-6 border border-white/60 shadow-sm">
                {/* Order Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ivory-300/40 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-charcoal-800 font-mono">Order #{order.orderNumber}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${payMeta?.color || 'bg-amber-100 text-amber-700'}`}>
                        {payMeta?.label || order.paymentStatus}
                      </span>
                    </div>
                    <p className="text-xs text-charcoal-400 mt-0.5">Purchased on {formatDate(order.createdAt)} · {PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${statusMeta?.color || 'bg-ivory-200 text-charcoal-700'}`}>
                      {statusMeta?.label || canonicalKey}
                    </span>
                    <span className="font-display text-lg font-bold text-charcoal-800">
                      {formatPrice(order.totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Order Items */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {order.items?.map((item, idx) => {
                    const targetProductId = item.productId?._id || item.productId;
                    const itemCanonicalKey = resolveStatus(item.fulfillmentStatus);
                    const itemStatusMeta = ORDER_STATUSES[itemCanonicalKey];

                    return (
                      <div key={idx} className="flex items-center gap-4 glass p-3 rounded-2xl bg-white/40">
                        <img
                          src={item.image || 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=200'}
                          alt={item.name}
                          loading="lazy"
                          decoding="async"
                          width={64}
                          height={80}
                          className="w-16 h-20 object-cover rounded-xl bg-ivory-200 flex-shrink-0"
                        />
                        <div className="text-xs space-y-1 min-w-0 flex-1">
                          {targetProductId ? (
                            <Link
                              to={`/product/${targetProductId}`}
                              className="font-semibold text-charcoal-700 hover:text-champagne-600 block truncate group"
                            >
                              <span className="truncate">{item.name}</span>
                              <ExternalLink size={10} className="inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                          ) : (
                            <p className="font-semibold text-charcoal-700 truncate">{item.name}</p>
                          )}
                          <p className="text-charcoal-400 text-[11px]">
                            Qty: {item.quantity} {item.size && `• Size: ${item.size}`} {item.color && `• Color: ${item.color}`}
                          </p>
                          {item.sellerNameSnapshot && (
                            <p className="text-[10px] text-charcoal-400 font-medium truncate">
                              Sold by: <span className="text-charcoal-600">{item.sellerNameSnapshot}</span>
                            </p>
                          )}
                          <p className="font-bold text-charcoal-800">{formatPrice(item.price)}</p>
                          {item.fulfillmentStatus && (
                            <p className="text-[10px] uppercase font-bold text-champagne-700">
                              Item status: {itemStatusMeta?.label || item.fulfillmentStatus}
                            </p>
                          )}
                          {item.trackingNumber && <p className="text-[10px] text-charcoal-400">{item.courier || 'Courier'}: {item.trackingNumber}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Shipping details & Total Breakdown */}
                <div className="pt-4 border-t border-ivory-300/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-charcoal-500">
                  {order.shippingAddress && (
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-champagne-600 flex-shrink-0" />
                      <span>
                        Delivering to: <strong>{order.shippingAddress.name}</strong>, {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pincode}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-4 sm:ml-auto">
                    <span>Subtotal: {formatPrice(order.subtotal || order.totalAmount)}</span>
                    <span>Shipping: {order.shippingAmount === 0 ? 'Free' : formatPrice(order.shippingAmount || 0)}</span>
                    <span className="font-bold text-charcoal-800">Total: {formatPrice(order.totalAmount)}</span>
                  </div>
                </div>

                {/* Track Order Button on its own row, full-width on mobile, min 40px tall, high contrast */}
                <div className="pt-2 flex flex-col sm:flex-row sm:justify-end">
                  <Link
                    to={`/orders/${order._id}`}
                    className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 min-h-[40px] rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm ${
                      isPendingUpi
                        ? 'bg-amber-600 text-white hover:bg-amber-700 border border-amber-600'
                        : 'bg-charcoal-800 text-white hover:bg-charcoal-700 border border-charcoal-800'
                    }`}
                  >
                    <Truck size={16} />
                    <span>{isPendingUpi ? 'Complete payment' : 'Track order'}</span>
                  </Link>
                </div>
              </div>
            );
          })}

          <div ref={sentinelRef} />
          {loadingMore && (
            <div className="flex justify-center py-4">
              <Spinner size="sm" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
