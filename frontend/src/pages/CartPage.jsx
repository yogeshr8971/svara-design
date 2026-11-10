import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ShoppingBag, ArrowRight, ShieldCheck, AlertTriangle, AlertCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import { formatPrice } from '../utils/formatPrice';
import { useCart } from '../context/CartContext';

export default function CartPage() {
  const {
    cartItems,
    cartTotal,
    shippingAmount,
    totalAmount,
    pricing,
    hasOutOfStock,
    updateQuantity,
    removeFromCart,
    clearCart,
    loading,
  } = useCart();
  const navigate = useNavigate();

  if (cartItems.length === 0 && !loading) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-champagne-100 text-champagne-500 flex items-center justify-center mx-auto">
          <ShoppingBag size={28} />
        </div>
        <h2 className="font-display text-2xl font-bold text-charcoal-700">Your shopping bag is empty</h2>
        <p className="text-xs text-charcoal-400">
          Explore our latest atelier collections and experience our virtual curate studio.
        </p>
        <Link to="/shop">
          <Button variant="primary" size="md" className="min-h-[44px]">
            <span>Explore Collection</span>
            <ArrowRight size={16} />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <span className="text-xs font-bold uppercase tracking-widest text-champagne-600">Review Items</span>
        <h1 className="section-heading text-3xl font-bold text-charcoal-900">Shopping Bag</h1>
      </div>

      {hasOutOfStock && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-800">
          <AlertCircle size={18} className="text-rose-600 shrink-0" />
          <span>
            One or more items in your shopping bag are currently out of stock. Please remove them before proceeding to checkout.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Items List */}
        <div className="lg:col-span-2 space-y-4">
          {cartItems.map((item) => {
            const stock = item.productId?.stock ?? item.stock ?? 20;
            const isOutOfStock = stock <= 0;
            const isLowStock = stock > 0 && stock < 5;

            return (
              <div
                key={item._id}
                className={`glass rounded-3xl p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center ${
                  isOutOfStock ? 'border-rose-200 bg-rose-50/20' : ''
                }`}
              >
                <img
                  src={item.image || item.productId?.images?.[0]?.url || 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=200'}
                  alt={item.name}
                  className="w-20 sm:w-24 aspect-[3/4] object-cover rounded-2xl bg-ivory-200 shrink-0"
                />

                <div className="flex-1 space-y-1 w-full">
                  <div className="flex justify-between items-start">
                    <h3 className="font-display text-base font-semibold text-charcoal-800">{item.name}</h3>
                    {isOutOfStock && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800">
                        Out of Stock
                      </span>
                    )}
                    {isLowStock && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 flex items-center gap-1">
                        <AlertTriangle size={10} /> Low Stock: Only {stock} left
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-charcoal-500">
                    Size: <span className="font-semibold text-charcoal-700">{item.size || 'Standard'}</span> | Color:{' '}
                    <span className="font-semibold text-charcoal-700">{item.color || 'Standard'}</span>
                  </p>

                  <div className="flex items-baseline gap-2 pt-1">
                    <span className="font-bold text-charcoal-900 text-sm sm:text-base">
                      {formatPrice(item.price)}
                    </span>
                    {item.quantity > 1 && (
                      <span className="text-[11px] text-charcoal-400">
                        ({formatPrice(item.price * item.quantity)})
                      </span>
                    )}
                  </div>

                  {/* Quantity Controls & Remove */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center border border-ivory-300 rounded-xl overflow-hidden glass">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item._id, Math.max(1, item.quantity - 1))}
                        disabled={isOutOfStock}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center hover:bg-white/60 text-charcoal-600 font-bold disabled:opacity-40"
                      >
                        -
                      </button>
                      <span className="px-3 text-xs font-semibold text-charcoal-800">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item._id, item.quantity + 1)}
                        disabled={isOutOfStock || item.quantity >= stock}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center hover:bg-white/60 text-charcoal-600 font-bold disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item._id)}
                      className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-charcoal-400 hover:text-burgundy-600 hover:bg-rose-50 transition-colors flex items-center justify-center"
                      title="Remove item from bag"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="flex justify-between items-center pt-2">
            <Link to="/shop" className="text-xs text-charcoal-600 hover:text-burgundy-600 font-semibold min-h-[44px] flex items-center">
              ← Continue Shopping
            </Link>
            <button
              type="button"
              onClick={clearCart}
              className="text-xs text-burgundy-600 hover:text-burgundy-700 font-medium min-h-[44px] flex items-center"
            >
              Clear Bag
            </button>
          </div>
        </div>

        {/* Server Authoritative Order Summary */}
        <div className="glass rounded-3xl p-6 sm:p-8 space-y-6">
          <h3 className="font-display text-lg font-bold text-charcoal-800 border-b border-ivory-300/40 pb-3">
            Order Summary
          </h3>

          <div className="space-y-3 text-xs text-charcoal-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-bold text-charcoal-800">{formatPrice(cartTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Admin Assigned Shipping</span>
              <span>
                {shippingAmount === 0 ? (
                  <span className="text-emerald-700 font-bold">Free</span>
                ) : (
                  formatPrice(shippingAmount)
                )}
              </span>
            </div>

            <div className="border-t border-ivory-300/40 pt-3 flex justify-between text-base font-bold text-charcoal-900">
              <span>Verified Total</span>
              <span>{formatPrice(totalAmount)}</span>
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate('/checkout')}
            disabled={hasOutOfStock || cartItems.length === 0}
            className="w-full justify-center min-h-[48px]"
          >
            <span>Proceed to Checkout</span>
            <ArrowRight size={16} />
          </Button>

          <div className="flex items-center justify-center gap-2 text-[11px] text-charcoal-500">
            <ShieldCheck size={14} className="text-champagne-600" />
            <span>Encrypted Server-Verified Razorpay Checkout</span>
          </div>
        </div>
      </div>
    </div>
  );
}
