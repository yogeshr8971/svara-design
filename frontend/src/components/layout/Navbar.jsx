import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Heart, Menu, X, Sparkles, ChevronDown, Shield, LogOut, User as UserIcon, Package, Store } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useCredits } from '../../context/CreditContext';
import NotificationBell from '../notifications/NotificationBell';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const { user, logout, isAdmin, isSeller } = useAuth();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const { credits } = useCredits();
  const navigate = useNavigate();
  const location = useLocation();
  const profileRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Automatically close menus on route changes
  useEffect(() => {
    setMobileMenuOpen(false);
    setProfileDropdownOpen(false);
  }, [location.pathname]);

  // Close profile dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Navigation tabs — Wishlist is included directly under menu tab options in any case
  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Curate Look', path: '/curate' },
    { name: 'Shop All', path: '/shop' },
    { name: 'AI Try On', path: '/playground' },
    { name: 'Wardrobe', path: '/wardrobe' },
    { name: 'Wishlist', path: '/wishlist' },
    { name: 'Contact', path: '/contact' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled ? 'py-2 sm:py-3' : 'py-3 sm:py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <nav
          className={`relative flex items-center justify-between px-3.5 sm:px-6 py-2.5 sm:py-3.5 rounded-full transition-all duration-300 ${
            scrolled
              ? 'glass-strong shadow-glass'
              : 'glass bg-white/40 border-white/30 backdrop-blur-md'
          }`}
        >
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <span className="font-display text-xl sm:text-2xl font-bold tracking-widest text-charcoal-700 group-hover:text-champagne-500 transition-colors">
              SVARA
            </span>
          </Link>

          {/* Desktop Nav Links (visible on lg: 1024px+, collapsed on mobile/tablet for a clean view) */}
          <div className="hidden lg:flex items-center gap-5 xl:gap-7">
            {navLinks.map((link) => (
              <NavLink
                key={link.name}
                to={link.path}
                className={({ isActive }) =>
                  `relative text-sm tracking-wider font-medium transition-colors hover:text-champagne-500 flex items-center gap-1.5 ${
                    isActive ? 'text-champagne-500 font-semibold' : 'text-charcoal-500'
                  }`
                }
              >
                <span>{link.name}</span>
                {link.name === 'Wishlist' && wishlistCount > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] min-w-[18px] h-[18px] px-1 rounded-full inline-flex items-center justify-center font-bold leading-none shadow-2xs">
                    {wishlistCount}
                  </span>
                )}
              </NavLink>
            ))}
          </div>

          {/* Right Controls (clean responsive fit for mobile, tablet & desktop) */}
          <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
            {/* Credits Badge (shown on tablets & desktops, tucked into mobile drawer for phone screen clarity) */}
            {user && (
              <Link
                to="/credits"
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-champagne-100/80 border border-champagne-300 text-charcoal-700 text-xs font-medium hover:bg-champagne-200 transition-colors shadow-2xs"
                title="AI Virtual Try-On Credits"
              >
                <Sparkles size={13} className="text-champagne-500 fill-champagne-400 shrink-0" />
                <span>{credits} Credits</span>
              </Link>
            )}

            {/* Notification Bell (compact) */}
            {user && <NotificationBell />}

            {/* Shopping Cart */}
            <Link
              to="/cart"
              className="relative p-2 text-charcoal-600 hover:text-charcoal-900 transition-colors rounded-full hover:bg-white/50 shrink-0"
              aria-label="Cart"
            >
              <ShoppingBag size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-charcoal-700 text-white text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center font-bold leading-none shadow-2xs">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* User Profile / Menu Dropdown */}
            {user ? (
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-1 p-1 rounded-full hover:bg-white/50 transition-colors border border-transparent hover:border-ivory-300"
                  aria-label="User account menu"
                >
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-champagne-300 text-charcoal-700 flex items-center justify-center font-bold text-xs overflow-hidden shrink-0">
                    {user.profileImage ? (
                      <img src={user.profileImage} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      user.name?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  <ChevronDown size={13} className="text-charcoal-400 hidden sm:block" />
                </button>

                <AnimatePresence>
                  {profileDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-3 w-56 glass-strong rounded-2xl p-2 shadow-xl border border-white/60 z-50 text-sm"
                    >
                      <div className="px-3 py-2 border-b border-ivory-300/40">
                        <p className="font-semibold text-charcoal-800 truncate">{user.name}</p>
                        <p className="text-xs text-charcoal-400 truncate">{user.email}</p>
                        {user.role === 'seller' && (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-burgundy-100 text-burgundy-700 text-[10px] font-bold uppercase tracking-wider">
                            Seller: {user.businessName || 'Atelier'}
                          </span>
                        )}
                      </div>

                      <div className="py-1">
                        <Link
                          to="/profile"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-charcoal-600 hover:bg-ivory-200/70 transition-colors"
                        >
                          <UserIcon size={14} className="text-charcoal-400" />
                          <span>My Profile</span>
                        </Link>
                        <Link
                          to="/orders"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-charcoal-600 hover:bg-ivory-200/70 transition-colors"
                        >
                          <Package size={14} className="text-charcoal-400" />
                          <span>Orders</span>
                        </Link>
                        <Link
                          to="/wishlist"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center justify-between px-3 py-2 rounded-xl text-charcoal-600 hover:bg-ivory-200/70 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <Heart size={14} className="text-rose-500" />
                            <span>Wishlist</span>
                          </span>
                          {wishlistCount > 0 && (
                            <span className="bg-rose-100 text-rose-700 text-[11px] px-1.5 py-0.2 rounded-full font-bold">
                              {wishlistCount}
                            </span>
                          )}
                        </Link>
                        <Link
                          to="/credits"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-charcoal-600 hover:bg-ivory-200/70 transition-colors"
                        >
                          <Sparkles size={14} className="text-champagne-500" />
                          <span>Buy Credits</span>
                        </Link>

                        {/* Seller Dashboard Link */}
                        {isSeller && (
                          <Link
                            to="/seller/dashboard"
                            onClick={() => setProfileDropdownOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-burgundy-600 font-medium hover:bg-rose-50 transition-colors"
                          >
                            <Store size={14} />
                            <span>Seller Studio</span>
                          </Link>
                        )}

                        {/* Partner Link for non-sellers/non-admins */}
                        {!isSeller && !isAdmin && (
                          <Link
                            to="/seller/register"
                            onClick={() => setProfileDropdownOpen(false)}
                            className="block px-3 py-2 rounded-xl text-champagne-700 font-medium hover:bg-champagne-100/50 transition-colors"
                          >
                            Become a Seller
                          </Link>
                        )}

                        {/* Admin Portal Link */}
                        {isAdmin && (
                          <a
                            href={import.meta.env.VITE_ADMIN_URL || 'http://localhost:5174'}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setProfileDropdownOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-burgundy-600 font-medium hover:bg-rose-50 transition-colors"
                          >
                            <Shield size={14} />
                            <span>Admin Portal ↗</span>
                          </a>
                        )}
                      </div>

                      <div className="pt-1 border-t border-ivory-300/40">
                        <button
                          type="button"
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            logout();
                            navigate('/');
                          }}
                          className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <LogOut size={14} />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-charcoal-700 text-white text-xs tracking-wider uppercase font-medium hover:bg-charcoal-800 transition-colors shadow-2xs"
              >
                Sign In
              </Link>
            )}

            {/* Mobile / Tablet Menu Toggle (visible on < lg) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-charcoal-600 hover:text-charcoal-900 rounded-full hover:bg-white/50 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center shrink-0"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile & Tablet Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden glass-strong mx-3 sm:mx-6 mt-2 rounded-3xl p-5 sm:p-6 shadow-2xl border border-white/60 max-h-[85vh] overflow-y-auto"
          >
            {/* Header info inside drawer */}
            {user ? (
              <div className="flex items-center justify-between pb-4 border-b border-ivory-200/60 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-champagne-300 text-charcoal-700 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                    {user.profileImage ? (
                      <img src={user.profileImage} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      user.name?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-charcoal-800 text-sm truncate">{user.name}</p>
                    <p className="text-xs text-charcoal-400 truncate">{user.email}</p>
                  </div>
                </div>
                <Link
                  to="/credits"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-champagne-100/90 border border-champagne-300 text-charcoal-700 text-xs font-semibold shrink-0"
                >
                  <Sparkles size={14} className="text-champagne-500 fill-champagne-400" />
                  <span>{credits} Credits</span>
                </Link>
              </div>
            ) : (
              <div className="flex items-center justify-between pb-4 border-b border-ivory-200/60 mb-3">
                <div>
                  <p className="font-display font-bold text-charcoal-800 text-base">Welcome to SVARA</p>
                  <p className="text-xs text-charcoal-400">Luxury Indian Couture</p>
                </div>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-2 rounded-full bg-charcoal-800 text-white text-xs font-semibold uppercase tracking-wider hover:bg-charcoal-900 transition-colors shadow-2xs"
                >
                  Sign In
                </Link>
              </div>
            )}

            {/* Menu Tab Options — Clean, high-contrast list */}
            <div className="flex flex-col gap-1 py-1">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.name}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-base font-medium transition-colors ${
                      isActive
                        ? 'bg-champagne-100 text-champagne-800 font-semibold shadow-2xs'
                        : 'text-charcoal-700 hover:bg-white/60'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      {link.name === 'Wishlist' && (
                        <Heart size={18} className="text-rose-500 fill-rose-50" />
                      )}
                      <span>{link.name}</span>
                    </span>
                    {link.name === 'Wishlist' && wishlistCount > 0 && (
                      <span className="bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                        {wishlistCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Account / Portal Section for mobile & tablet users */}
            {user && (
              <div className="pt-3 mt-3 border-t border-ivory-200/60 flex flex-col gap-1">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <Link
                    to="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/50 text-charcoal-700 text-xs font-semibold hover:bg-white transition-colors"
                  >
                    <UserIcon size={14} className="text-charcoal-500" />
                    <span>My Profile</span>
                  </Link>
                  <Link
                    to="/orders"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/50 text-charcoal-700 text-xs font-semibold hover:bg-white transition-colors"
                  >
                    <Package size={14} className="text-charcoal-500" />
                    <span>My Orders</span>
                  </Link>
                </div>

                {isSeller && (
                  <Link
                    to="/seller/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-burgundy-700 font-semibold bg-rose-50/70 hover:bg-rose-100 transition-colors text-sm"
                  >
                    <Store size={15} />
                    <span>Seller Studio</span>
                  </Link>
                )}

                {!isSeller && !isAdmin && (
                  <Link
                    to="/seller/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-champagne-800 font-medium bg-champagne-50 hover:bg-champagne-100 transition-colors text-sm"
                  >
                    <span>Become a Seller</span>
                  </Link>
                )}

                {isAdmin && (
                  <a
                    href={import.meta.env.VITE_ADMIN_URL || 'http://localhost:5174'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-burgundy-700 font-semibold bg-rose-50/70 hover:bg-rose-100 transition-colors text-sm"
                  >
                    <Shield size={15} />
                    <span>Admin Portal ↗</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                    navigate('/');
                  }}
                  className="flex items-center justify-center gap-2 mt-2 w-full py-2.5 px-4 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 font-semibold text-xs transition-colors"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
