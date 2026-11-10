import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as cartService from '../services/cartService';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const CartContext = createContext();

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [pricing, setPricing] = useState({
    subtotal: 0,
    shippingAmount: 0,
    totalAmount: 0,
  });
  const [loading, setLoading] = useState(false);

  const applyCartData = (data) => {
    if (!data) return;
    const items = data.cart?.items || [];
    setCartItems(items);
    if (data.pricing) {
      setPricing({
        subtotal: data.pricing.subtotal ?? 0,
        shippingAmount: data.pricing.shippingAmount ?? 0,
        totalAmount: data.pricing.totalAmount ?? 0,
      });
    } else {
      // Local fallback: shipping 0
      const localSubtotal = items.reduce((acc, i) => acc + (i.price || 0) * (i.quantity || 1), 0);
      setPricing({ subtotal: localSubtotal, shippingAmount: 0, totalAmount: localSubtotal });
    }
  };

  const fetchCart = useCallback(async () => {
    if (!user) {
      setCartItems([]);
      setPricing({ subtotal: 0, shippingAmount: 0, totalAmount: 0 });
      return;
    }
    try {
      setLoading(true);
      const data = await cartService.getCart();
      applyCartData(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addToCart = async (productId, size, color, quantity = 1) => {
    try {
      const data = await cartService.addToCart({ productId, size, color, quantity });
      applyCartData(data);
      toast.success('Added to cart');
      return data;
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to add to cart');
      return null;
    }
  };

  const updateQuantity = async (itemId, quantity) => {
    try {
      const data = await cartService.updateItem(itemId, quantity);
      applyCartData(data);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to update cart');
    }
  };

  const removeFromCart = async (itemId) => {
    try {
      const data = await cartService.removeItem(itemId);
      applyCartData(data);
      toast.success('Removed from cart');
    } catch {
      toast.error('Failed to remove item');
    }
  };

  const clearCart = async () => {
    try {
      await cartService.clearCart();
      setCartItems([]);
      setPricing({ subtotal: 0, shippingAmount: 0, totalAmount: 0 });
    } catch {}
  };

  const cartCount = cartItems.reduce((acc, i) => acc + i.quantity, 0);
  const cartTotal = pricing.subtotal;
  const shippingAmount = pricing.shippingAmount;
  const totalAmount = pricing.totalAmount;

  // Stock status checks for checkout guards
  const hasOutOfStock = cartItems.some((i) => i.productId?.stock === 0 || i.stock === 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartCount,
        cartTotal,
        shippingAmount,
        totalAmount,
        pricing,
        hasOutOfStock,
        loading,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        refreshCart: fetchCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
