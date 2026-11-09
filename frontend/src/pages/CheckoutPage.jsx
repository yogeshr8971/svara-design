import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, CreditCard, Smartphone, Banknote } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { formatPrice } from '../utils/formatPrice';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import * as orderService from '../services/orderService';
import toast from 'react-hot-toast';

const COD_MAX = 10000;
export default function CheckoutPage() {
  const { cartItems, cartTotal, shippingAmount, totalAmount: serverTotal, hasOutOfStock, refreshCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Authoritative server-calculated shipping fee and final total
  const shipping = shippingAmount ?? cartItems.reduce((sum, item) => {
    const fee = item.productId?.shippingFee ?? item.shippingFee;
    return sum + (fee !== undefined && fee !== null ? Number(fee) * item.quantity : 0);
  }, 0);
  const totalAmount = serverTotal ?? (cartTotal + shipping);

  const codBlocked = totalAmount > COD_MAX;
  const METHODS = [
    { id: 'razorpay', label: 'Card, Netbanking, Wallet, UPI', hint: 'Instant confirmation via Razorpay', icon: CreditCard },
    { id: 'upi', label: 'Pay directly via UPI', hint: 'Pay to our UPI ID, then enter the reference', icon: Smartphone },
    { id: 'cod', label: 'Cash on Delivery', hint: codBlocked ? `Available up to ₹${COD_MAX}` : 'Pay when your order arrives', icon: Banknote, disabled: codBlocked },
  ];
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState('razorpay');
  const placedRef = useRef(false); // stops the empty-cart redirect from racing the post-order navigation
  const [address, setAddress] = useState({
    name: user?.name || '',
    phone: '',
    street: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
  });

  const handleChange = (e) => {
    setAddress({ ...address, [e.target.name]: e.target.value });
  };

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (hasOutOfStock) {
      toast.error('One or more items in your cart are out of stock. Please return to your cart to update.');
      navigate('/cart');
      return;
    }
    if (!address.name || !address.phone || !address.street || !address.city || !address.state || !address.pincode) {
      toast.error('Please fill in complete shipping information.');
      return;
    }
    if (!/^\d{6}$/.test(address.pincode.trim())) return toast.error('Enter a valid 6-digit PIN code.');

    try {
      setLoading(true);

      // Cash on Delivery & UPI: no gateway script needed.
      if (method === 'cod' || method === 'upi') {
        const res = await orderService.createOrder({ shippingAddress: address, paymentMethod: method });
        placedRef.current = true;
        await refreshCart();
        if (method === 'cod') toast.success('Order confirmed! Pay when it arrives.');
        else toast.success('Order created — complete the UPI payment to confirm it.');
        navigate(`/orders/${res.order._id}`);
        return;
      }

      const isRzpReady = await loadRazorpay();
      if (!isRzpReady) {
        toast.error('Payment gateway failed to load. Please check your connection.');
        return;
      }

      const res = await orderService.createOrder({ shippingAddress: address, paymentMethod: 'razorpay' });
      const { order, razorpayOrderId, keyId, amountInPaise } = res;

      const options = {
        key: keyId,
        amount: amountInPaise,
        currency: 'INR',
        name: 'SVARA',
        description: `Order #${order.orderNumber}`,
        order_id: razorpayOrderId,
        handler: async (response) => {
          try {
            await orderService.verifyPayment(order._id, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast.success('Payment verified! Your order has been placed.');
            placedRef.current = true;
            await refreshCart();
            navigate(`/orders/${order._id}`);
          } catch {
            toast.error('We could not verify the payment yet. If money was debited, your order will confirm automatically.');
            navigate(`/orders/${order._id}`);
          }
        },
        modal: { ondismiss: () => toast('Payment window closed. You can retry from Checkout.') },
        prefill: { name: address.name, email: user?.email, contact: address.phone },
        theme: { color: '#242019' },
      };
      new window.Razorpay(options).open();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  if (cartItems.length === 0 && !placedRef.current) {
    navigate('/cart');
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <span className="text-xs font-bold uppercase tracking-widest text-champagne-500">Secure Purchase</span>
        <h1 className="section-heading text-3xl font-bold">Express Checkout</h1>
      </div>

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Shipping Form */}
        <div className="lg:col-span-2 glass rounded-3xl p-6 sm:p-8 space-y-6">
          <h3 className="font-display text-lg font-bold text-charcoal-700 border-b border-ivory-300/40 pb-3">
            Shipping Address
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Recipient Name"
              name="name"
              value={address.name}
              onChange={handleChange}
              required
            />
            <Input
              label="Contact Number"
              name="phone"
              placeholder="10-digit mobile number" inputMode="tel"
              value={address.phone}
              onChange={handleChange}
              required
            />
          </div>

          <Input
            label="Street Address & Landmark"
            name="street"
            placeholder="Flat 402, Royal Gardens, MG Road"
            value={address.street}
            onChange={handleChange}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="City"
              name="city"
              value={address.city}
              onChange={handleChange}
              required
            />
            <Input
              label="State"
              name="state"
              value={address.state}
              onChange={handleChange}
              required
            />
            <Input
              label="PIN Code"
              name="pincode"
              value={address.pincode}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        {/* Order Review Box */}
        <div className="glass rounded-3xl p-6 sm:p-8 space-y-6">
          <h3 className="font-display text-lg font-bold text-charcoal-700 border-b border-ivory-300/40 pb-3">
            Summary ({cartItems.length} Items)
          </h3>

          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {cartItems.map((item) => (
              <div key={item._id} className="flex items-center gap-3 text-xs">
                <img src={item.image} alt={item.name} className="w-12 h-14 object-cover rounded-xl bg-ivory-200" />
                <div className="flex-1 truncate">
                  <p className="font-semibold text-charcoal-700 truncate">{item.name}</p>
                  <p className="text-charcoal-400">Qty: {item.quantity} | Size: {item.size}</p>
                </div>
                <span className="font-bold text-charcoal-700">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-ivory-300/40 pt-3 space-y-2 text-xs text-charcoal-500">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-bold text-charcoal-700">{formatPrice(cartTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span>{shipping === 0 ? <span className="text-emerald-600 font-bold">Free</span> : formatPrice(shipping)}</span>
            </div>
            <div className="border-t border-ivory-300/40 pt-2 flex justify-between text-base font-bold text-charcoal-800">
              <span>Total Payable</span>
              <span>{formatPrice(totalAmount)}</span>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs uppercase font-medium tracking-wider text-charcoal-400 mb-2">Payment method</legend>
            {METHODS.map(({ id, label, hint, icon: Icon, disabled }) => (
              <label key={id} className={`flex items-start gap-3 rounded-2xl border p-3 cursor-pointer transition ${method === id ? 'border-champagne-500 bg-champagne-50' : 'border-ivory-300 bg-white/50'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                <input type="radio" name="method" className="mt-1" checked={method === id} disabled={disabled} onChange={() => setMethod(id)} />
                <Icon size={16} className="mt-0.5 text-charcoal-500 shrink-0" />
                <span><span className="block text-xs font-semibold text-charcoal-700">{label}</span><span className="block text-[11px] text-charcoal-400">{hint}</span></span>
              </label>
            ))}
          </fieldset>

          <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full justify-center">
            <span>{method === 'cod' ? 'Place order (Pay on delivery)' : method === 'upi' ? 'Continue to UPI payment' : 'Pay securely'}</span>
            <ArrowRight size={16} />
          </Button>

          <div className="flex items-center justify-center gap-2 text-[11px] text-charcoal-400">
            <ShieldCheck size={14} className="text-champagne-500" />
            <span>Encrypted 256-Bit Transactions</span>
          </div>
        </div>
      </form>
    </div>
  );
}
