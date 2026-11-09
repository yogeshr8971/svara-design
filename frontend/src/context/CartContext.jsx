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
    freeShippingThreshold: 2000,
  });
  const [loading, setLoading] = useState(false);

  const applyCartData = (cartData) => {
    if (!cartData) return;
    const items = cartData.items || [];
    setCartItems(items);
    setPricing({
      subtotal: cartData.subtotal ?? items.reduce((acc, i) => acc + (i.price || 0) * (i.quantity || 1), 0),
      shippingAmount: cartData.shippingAmount ?? 0,
      totalAmount: cartData.totalAmount ?? items.reduce((acc, i) => acc + (i.price || 0) * (i.quantity || 1), 0),
      freeShippingThreshold: cartData.freeShippingThreshold ?? 2000,
    });
  };

  const fetchCart = useCallback(async () => {
    if (!user) {
      setCartItems([]);
      setPricing({ subtotal: 0, shippingAmount: 0, totalAmount: 0, freeShippingThreshold: 2000 });
      return;
    }
    try {
      setLoading(true);
      const data = await cartService.getCart();
      applyCartData(data.cart);
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
      applyCartData(data.cart);
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
      applyCartData(data.cart);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to update cart');
    }
  };

  const removeFromCart = async (itemId) => {
    try {
      const data = await cartService.removeItem(itemId);
      applyCartData(data.cart);
      toast.success('Removed from cart');
    } catch {
      toast.error('Failed to remove item');
    }
  };

  const clearCart = async () => {
    try {
      await cartService.clearCart();
      setCartItems([]);
      setPricing({ subtotal: 0, shippingAmount: 0, totalAmount: 0, freeShippingThreshold: 2000 });
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
