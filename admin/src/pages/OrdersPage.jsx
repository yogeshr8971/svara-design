import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Truck,
  CheckCircle,
  Clock,
  Search,
  Filter,
  DollarSign,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Eye,
  RefreshCw,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import { formatPrice } from '../utils/formatPrice';
import { formatDate, formatDateTime } from '../utils/formatDate';
import * as adminService from '../services/adminService';
import toast from 'react-hot-toast';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  // Selected Order for Inspection / Transition Modals
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [shipModal, setShipModal] = useState({ isOpen: false, order: null, courier: '', trackingNumber: '', expectedDelivery: '' });
  const [deliverModal, setDeliverModal] = useState({ isOpen: false, order: null, note: '' });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await adminService.getAllOrders({
        limit: 100,
        status: statusFilter || undefined,
        paymentStatus: paymentFilter || undefined,
      });
      setOrders(res.orders || []);
    } catch {
      toast.error('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, paymentFilter]);

  // Transition 1: Ordered -> Shipped (§10)
  const handleShipSubmit = async (e) => {
    e.preventDefault();
    const { order, courier, trackingNumber, expectedDelivery } = shipModal;
    if (!order) return;

    try {
      setActionLoading(true);
      const res = await adminService.updateOrderStatus(order._id, {
        status: 'Shipped',
        courier: courier.trim(),
        trackingNumber: trackingNumber.trim(),
        expectedDelivery,
        note: `Dispatched via ${courier.trim()} (${trackingNumber.trim()})`,
      });
      setOrders((prev) => prev.map((o) => (o._id === order._id ? res.order : o)));
      if (selectedOrder?._id === order._id) setSelectedOrder(res.order);
      setShipModal({ isOpen: false, order: null, courier: '', trackingNumber: '', expectedDelivery: '' });
      toast.success(`Order ${order.orderNumber} transitioned to Shipped.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update order to Shipped.');
    } finally {
      setActionLoading(false);
    }
  };

  // Transition 2: Shipped -> Delivered (§10)
  const handleDeliverSubmit = async () => {
    const { order, note } = deliverModal;
    if (!order) return;

    try {
      setActionLoading(true);
      const res = await adminService.updateOrderStatus(order._id, {
        status: 'Delivered',
        note: note.trim() || 'Delivered to customer address',
      });
      setOrders((prev) => prev.map((o) => (o._id === order._id ? res.order : o)));
      if (selectedOrder?._id === order._id) setSelectedOrder(res.order);
      setDeliverModal({ isOpen: false, order: null, note: '' });
      toast.success(`Order ${order.orderNumber} transitioned to Delivered.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update order to Delivered.');
    } finally {
      setActionLoading(false);
    }
  };

  // Record Cash on Delivery (COD) Payment Collection (§10, §11)
  const handleRecordCodPayment = async (order) => {
    if (!window.confirm(`Confirm collection of ${formatPrice(order.totalAmount)} for COD Order ${order.orderNumber}?`)) {
      return;
    }

    try {
      setActionLoading(true);
      const res = await adminService.recordCodPayment(order._id);
      setOrders((prev) => prev.map((o) => (o._id === order._id ? res.order : o)));
      if (selectedOrder?._id === order._id) setSelectedOrder(res.order);
      toast.success(`COD collection of ${formatPrice(order.totalAmount)} recorded.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record COD payment.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((o) => {
    if (search) {
      const q = search.toLowerCase();
      const matchNum = o.orderNumber?.toLowerCase().includes(q);
      const matchCust = o.userId?.name?.toLowerCase().includes(q) || o.shippingAddress?.name?.toLowerCase().includes(q);
      if (!matchNum && !matchCust) return false;
    }
    if (methodFilter && o.paymentMethod !== methodFilter) return false;
    if (paymentFilter === 'paid' && o.paymentStatus !== 'paid') return false;
    if (paymentFilter === 'unpaid' && o.paymentStatus === 'paid') return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="section-heading text-2xl font-bold">Orders & Fulfilment Control</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-burgundy-100 text-burgundy-800">
              3-Stage Lifecycle
            </span>
          </div>
          <p className="text-xs text-charcoal-400 mt-0.5">
            Strict administrator control of the 3 permitted order statuses: Ordered → Shipped → Delivered.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchOrders}>
          <RefreshCw size={14} />
          <span>Refresh Orders</span>
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="glass-card p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        <div className="relative">
          <input
            type="text"
            placeholder="Search order # or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-8 text-xs py-2"
          />
          <Search size={14} className="absolute left-2.5 top-3 text-charcoal-400" />
        </div>

        {/* Status filter: exactly 3 values (§10) */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field text-xs py-2"
        >
          <option value="">All Lifecycle Stages</option>
          <option value="Ordered">1. Ordered</option>
          <option value="Shipped">2. Shipped</option>
          <option value="Delivered">3. Delivered</option>
        </select>

        {/* Payment status filter */}
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="input-field text-xs py-2"
        >
          <option value="">All Payment States</option>
          <option value="paid">Paid (Collected)</option>
          <option value="unpaid">Unpaid</option>
        </select>

        {/* Payment method filter */}
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="input-field text-xs py-2"
        >
          <option value="">All Payment Methods</option>
          <option value="cod">Cash on Delivery (COD)</option>
          <option value="razorpay">Online (Razorpay)</option>
          <option value="upi">Direct UPI</option>
        </select>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-3">
          <ShoppingBag size={32} className="mx-auto text-charcoal-400" />
          <h3 className="font-display text-lg font-bold text-charcoal-700">No Orders Match Filter Criteria</h3>
          <p className="text-xs text-charcoal-400">Try adjusting your status or search filters above.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-ivory-100 text-charcoal-600 uppercase font-semibold text-[10px] tracking-wider border-b border-ivory-200">
                <tr>
                  <th className="p-3.5">Order ID</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Method</th>
                  <th className="p-3.5">Payment State</th>
                  <th className="p-3.5">Order Total</th>
                  <th className="p-3.5">Lifecycle Status</th>
                  <th className="p-3.5 text-right">Status Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-200">
                {filteredOrders.map((order) => {
                  const normalizedStatus = (order.orderStatus || '').toLowerCase();
                  const isOrdered = normalizedStatus === 'ordered';
                  const isShipped = normalizedStatus === 'shipped';
                  const isDelivered = normalizedStatus === 'delivered';
                  const isCod = order.paymentMethod === 'cod';
                  const isUnpaid = order.paymentStatus !== 'paid';

                  const badgeColors = {
                    ordered: 'bg-blue-100 text-blue-800 border-blue-200',
                    shipped: 'bg-amber-100 text-amber-800 border-amber-200',
                    delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                    pending_payment: 'bg-charcoal-100 text-charcoal-600 border-charcoal-200',
                  };
                  const badgeClass = badgeColors[normalizedStatus] || 'bg-ivory-200 text-charcoal-700';

                  return (
                    <tr key={order._id} className="hover:bg-ivory-50/80 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-charcoal-900">
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className="hover:text-burgundy-600 text-left underline underline-offset-2"
                        >
                          {order.orderNumber}
                        </button>
                      </td>
                      <td className="p-3.5 text-charcoal-500 whitespace-nowrap">{formatDate(order.createdAt)}</td>
                      <td className="p-3.5">
                        <div className="font-semibold text-charcoal-800">
                          {order.shippingAddress?.name || order.userId?.name || 'Customer'}
                        </div>
                        <div className="text-[10px] text-charcoal-400">
                          {order.shippingAddress?.city}, {order.shippingAddress?.state}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-ivory-200 text-charcoal-700">
                          {order.paymentMethod}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            order.paymentStatus === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {order.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                        </span>
                        {isCod && isUnpaid && (
                          <button
                            type="button"
                            onClick={() => handleRecordCodPayment(order)}
                            className="block text-[10px] font-bold text-emerald-700 hover:text-emerald-900 mt-1 underline"
                          >
                            Record Collection
                          </button>
                        )}
                      </td>
                      <td className="p-3.5 font-bold text-charcoal-900">{formatPrice(order.totalAmount)}</td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeClass}`}
                        >
                          {order.orderStatus}
                        </span>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Ordered -> Shipped Button */}
                          {isOrdered && (
                            <Button
                              variant="primary"
                              size="xs"
                              onClick={() =>
                                setShipModal({
                                  isOpen: true,
                                  order,
                                  courier: '',
                                  trackingNumber: '',
                                  expectedDelivery: '',
                                })
                              }
                              className="bg-amber-600 hover:bg-amber-700 text-white"
                            >
                              <Truck size={12} />
                              <span>Mark Shipped</span>
                            </Button>
                          )}

                          {/* Shipped -> Delivered Button */}
                          {isShipped && (
                            <Button
                              variant="primary"
                              size="xs"
                              onClick={() => setDeliverModal({ isOpen: true, order, note: '' })}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              <CheckCircle size={12} />
                              <span>Mark Delivered</span>
                            </Button>
                          )}

                          {/* Completed Delivered state */}
                          {isDelivered && (
                            <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 justify-end">
                              <CheckCircle size={12} /> Fulfilled
                            </span>
                          )}

                          {/* Inspect Modal Trigger */}
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => setSelectedOrder(order)}
                            title="Inspect order details"
                          >
                            <Eye size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Mark as Shipped (Transition 1) */}
      <Modal
        isOpen={shipModal.isOpen}
        onClose={() => setShipModal({ isOpen: false, order: null, courier: '', trackingNumber: '', expectedDelivery: '' })}
        title={`Dispatch & Ship Order — ${shipModal.order?.orderNumber}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleShipSubmit} className="space-y-4 text-xs">
          <p className="text-charcoal-500">
            Transition order from <strong>Ordered</strong> to <strong>Shipped</strong>. An automated dispatch email with expected delivery details will be sent to the customer.
          </p>

          <Input
            label="Courier Partner"
            placeholder="e.g. BlueDart, Delhivery, DTDC"
            value={shipModal.courier}
            onChange={(e) => setShipModal((prev) => ({ ...prev, courier: e.target.value }))}
            required
          />

          <Input
            label="Tracking / Waybill Number"
            placeholder="e.g. BLU198284729"
            value={shipModal.trackingNumber}
            onChange={(e) => setShipModal((prev) => ({ ...prev, trackingNumber: e.target.value }))}
            required
          />

          <Input
            label="Estimated Delivery Date (Optional)"
            type="date"
            value={shipModal.expectedDelivery}
            onChange={(e) => setShipModal((prev) => ({ ...prev, expectedDelivery: e.target.value }))}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-ivory-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShipModal({ isOpen: false, order: null, courier: '', trackingNumber: '', expectedDelivery: '' })}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={actionLoading}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Confirm Dispatch
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Mark as Delivered (Transition 2) */}
      <Modal
        isOpen={deliverModal.isOpen}
        onClose={() => setDeliverModal({ isOpen: false, order: null, note: '' })}
        title={`Confirm Order Delivery — ${deliverModal.order?.orderNumber}`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-charcoal-500">
            Transition order from <strong>Shipped</strong> to <strong>Delivered</strong>. An automated confirmation email will be delivered to the customer.
          </p>

          {deliverModal.order?.paymentMethod === 'cod' && deliverModal.order?.paymentStatus !== 'paid' && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle size={14} /> Cash on Delivery Order Notice (§10)
              </div>
              <p className="text-[11px]">
                This is a COD order of {formatPrice(deliverModal.order?.totalAmount)}. Delivering this order does not automatically mark payment as collected. You can record cash collection separately below or in the order list.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-700 mb-1">
              Delivery Fulfillment Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Delivered to customer; signed by recipient"
              value={deliverModal.note}
              onChange={(e) => setDeliverModal((prev) => ({ ...prev, note: e.target.value }))}
              className="input-field py-2 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-ivory-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeliverModal({ isOpen: false, order: null, note: '' })}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={actionLoading}
              onClick={handleDeliverSubmit}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Confirm Final Delivery
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 3: Detailed Order Inspection */}
      {selectedOrder && (
        <Modal
          isOpen={Boolean(selectedOrder)}
          onClose={() => setSelectedOrder(null)}
          title={`Order Breakdown — ${selectedOrder.orderNumber}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-5 text-xs">
            {/* Header meta */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-ivory-100 border border-ivory-300">
              <div>
                <span className="text-[10px] text-charcoal-400 font-semibold uppercase">Order Date</span>
                <p className="font-bold text-charcoal-800">{formatDate(selectedOrder.createdAt)}</p>
              </div>
              <div>
                <span className="text-[10px] text-charcoal-400 font-semibold uppercase">Payment</span>
                <p className="font-bold text-charcoal-800 uppercase">{selectedOrder.paymentMethod} ({selectedOrder.paymentStatus})</p>
              </div>
              <div>
                <span className="text-[10px] text-charcoal-400 font-semibold uppercase">Status</span>
                <p className="font-bold text-charcoal-800 uppercase">{selectedOrder.orderStatus}</p>
              </div>
              <div>
                <span className="text-[10px] text-charcoal-400 font-semibold uppercase">Grand Total</span>
                <p className="font-bold text-burgundy-700">{formatPrice(selectedOrder.totalAmount)}</p>
              </div>
            </div>

            {/* Customer & Address */}
            <div className="p-3.5 rounded-2xl border border-ivory-200 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-charcoal-500">Shipping Address</span>
              <p className="font-bold text-charcoal-800">{selectedOrder.shippingAddress?.name}</p>
              <p className="text-charcoal-600">{selectedOrder.shippingAddress?.street}</p>
              <p className="text-charcoal-600">
                {selectedOrder.shippingAddress?.city}, {selectedOrder.shippingAddress?.state} — {selectedOrder.shippingAddress?.pincode}
              </p>
              <p className="text-charcoal-600">Phone: {selectedOrder.shippingAddress?.phone}</p>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-charcoal-500">Order Items</span>
              <div className="divide-y divide-ivory-200 border border-ivory-200 rounded-2xl overflow-hidden">
                {selectedOrder.items?.map((item, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between gap-3 bg-white">
                    <div className="flex items-center gap-3">
                      {item.image && (
                        <img src={item.image} alt={item.name} className="w-10 h-12 object-cover rounded-lg border border-ivory-300" />
                      )}
                      <div>
                        <p className="font-bold text-charcoal-800">{item.name}</p>
                        <p className="text-[10px] text-charcoal-400">
                          Qty: {item.quantity} · {item.size || ''} {item.color || ''}
                          {item.shippingFee ? ` · Shipping: ₹${item.shippingFee}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-charcoal-800">{formatPrice(item.price * item.quantity)}</p>
                      <p className="text-[10px] text-charcoal-400">@{formatPrice(item.price)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline */}
            {selectedOrder.statusHistory?.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-charcoal-500">Audit Status Timeline (§4, §10)</span>
                <div className="p-3 rounded-2xl bg-ivory-100/60 border border-ivory-200 space-y-2">
                  {selectedOrder.statusHistory.map((h, i) => (
                    <div key={i} className="flex items-start justify-between text-[11px]">
                      <div>
                        <span className="font-bold text-charcoal-800 uppercase">{h.status}</span>
                        {h.note && <span className="text-charcoal-600 ml-2">— {h.note}</span>}
                      </div>
                      <span className="text-[10px] text-charcoal-400">{formatDateTime(h.at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
