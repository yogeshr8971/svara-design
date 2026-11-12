import React, { memo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingBag, Wand2, Star } from 'lucide-react';
import { formatPrice } from '../../utils/formatPrice';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import * as playgroundService from '../../services/playgroundService';
import toast from 'react-hot-toast';

const cardImageUrl = (url) => (
  url?.includes('res.cloudinary.com') && url.includes('/upload/')
    ? url.replace('/upload/', '/upload/w_640,c_fill,q_auto,f_auto/')
    : url
);

/** `footer` is optional extra content under the price (e.g. Curate Look's select button). */
const ProductCard = memo(function ProductCard({ product, footer = null }) {
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const isFavorited = isInWishlist(product._id);
  const imageUrl =
    cardImageUrl(product.images?.[0]?.url) ||
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=640&auto=format';

  const handleAddToPlayground = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast('Please sign in to add to your playground', { icon: '🪄' });
      navigate('/login');
      return;
    }
    try {
      await playgroundService.addProduct(product._id);
      toast.success('Added to your Try-On Playground!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add to playground');
    }
  }, [user, navigate, product._id]);

  const handleQuickAdd = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.stock <= 0) {
      toast.error('This design is currently out of stock.');
      return;
    }
    const defaultSize = product.sizes?.[0] || 'M';
    const defaultColor = product.colors?.[0]?.name || 'Standard';
    addToCart(product._id, defaultSize, defaultColor, 1);
  }, [product._id, product.stock, product.sizes, product.colors, addToCart]);

  const handleWishlistToggle = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product._id);
  }, [product._id, toggleWishlist]);

  const discountPercent = product.compareAtPrice && product.compareAtPrice > product.price
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0;

  return (
    <div className="product-card group flex flex-col justify-between">
      <Link
        to={`/product/${product.slug || product._id}`}
        className="block relative overflow-hidden bg-ivory-200 aspect-[3/4]"
      >
        {/* Original photo-based product image */}
        <img
          src={imageUrl}
          alt={product.name}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
          loading="lazy"
          decoding="async"
        />

        {/* Badges & Stock Alerts */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {product.stock <= 0 && (
            <span className="bg-rose-600 text-white text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full shadow-sm">
              Out of Stock
            </span>
          )}
          {product.stock > 0 && product.stock < 5 && (
            <span className="bg-amber-500 text-white text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full shadow-sm">
              Only {product.stock} left
            </span>
          )}
          {discountPercent > 0 && (
            <span className="bg-burgundy-500/90 text-white text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full backdrop-blur-xs">
              ↓ {discountPercent}% OFF
            </span>
          )}
          {product.trending && (
            <span className="bg-champagne-300 text-charcoal-700 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full backdrop-blur-xs">
              Trending
            </span>
          )}
        </div>

        {/* Wishlist Button */}
        <button
          onClick={handleWishlistToggle}
          className="absolute top-3 right-3 p-2 rounded-full glass bg-white/70 hover:bg-white text-charcoal-600 transition-colors shadow-sm z-10"
          aria-label="Wishlist"
        >
          <Heart
            size={16}
            className={`transition-colors ${isFavorited ? 'fill-rose-500 text-rose-500' : 'text-charcoal-500 hover:text-rose-500'}`}
          />
        </button>

        {/* Floating Actions on Hover */}
        <div className="absolute inset-x-3 bottom-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
          <button
            onClick={handleAddToPlayground}
            className="p-2 rounded-xl glass-strong text-charcoal-600 hover:bg-white transition-colors"
            title="Add to Playground"
          >
            <Wand2 size={14} />
          </button>
          <button
            onClick={handleQuickAdd}
            disabled={product.stock <= 0}
            className={`p-2 rounded-xl transition-colors ${
              product.stock <= 0
                ? 'bg-charcoal-300 text-charcoal-400 cursor-not-allowed'
                : 'bg-charcoal-600 text-white hover:bg-charcoal-700'
            }`}
            title={product.stock <= 0 ? 'Out of stock' : 'Quick Add to Cart'}
          >
            <ShoppingBag size={14} />
          </button>
        </div>
      </Link>

      {/* Details */}
      <div className="p-4 flex flex-col gap-1">
        <Link to={`/product/${product.slug || product._id}`}>
          <h3 className="font-display text-sm font-medium text-charcoal-700 truncate hover:text-champagne-500 transition-colors">
            {product.name}
          </h3>
        </Link>
        <div className="flex items-center gap-1.5 text-[11px]">
          {product.ratings?.count > 0 ? (
            <span className="inline-flex items-center gap-1 font-semibold text-charcoal-700">
              <Star size={11} className="fill-amber-400 text-amber-400" />
              <span>{Number(product.ratings.average).toFixed(1)}</span>
              <span className="text-charcoal-400 font-normal">({product.ratings.count})</span>
            </span>
          ) : (
            <span className="text-charcoal-400 font-light">No reviews</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="font-semibold text-charcoal-700 text-sm">{formatPrice(product.price)}</span>
          {discountPercent > 0 && (
            <>
              <span className="text-xs text-charcoal-300 line-through">
                {formatPrice(product.compareAtPrice)}
              </span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                ↓ {discountPercent}% OFF
              </span>
            </>
          )}
        </div>
        {footer}
      </div>
    </div>
  );
});

export default ProductCard;
