import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import AuthGuard from './components/auth/AuthGuard';
import SellerGuard from './components/auth/SellerGuard';
import Spinner from './components/ui/Spinner';

// ── Lazy-loaded pages (code-split per route for faster initial load) ──
const HomePage = lazy(() => import('./pages/HomePage'));
const ShopPage = lazy(() => import('./pages/ShopPage'));
const CategoryShoppingPage = lazy(() => import('./pages/CategoryShoppingPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const SellerLoginPage = lazy(() => import('./pages/SellerLoginPage'));
const SellerRegisterPage = lazy(() => import('./pages/SellerRegisterPage'));
const SellerDashboardPage = lazy(() => import('./pages/SellerDashboardPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const PlaygroundPage = lazy(() => import('./pages/PlaygroundPage'));
const WardrobePage = lazy(() => import('./pages/WardrobePage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const OrderTrackingPage = lazy(() => import('./pages/OrderTrackingPage'));
const WishlistPage = lazy(() => import('./pages/WishlistPage'));
const CreditsPage = lazy(() => import('./pages/CreditsPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// ── Suspense fallback ──
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Spinner size="lg" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="shop" element={<ShopPage />} />
          <Route path="curate" element={<CategoryShoppingPage />} />
          <Route path="product/:id" element={<ProductDetailPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="seller/login" element={<SellerLoginPage />} />
          <Route path="seller/register" element={<SellerRegisterPage />} />

          {/* Seller Studio protected routes */}
          <Route path="seller/dashboard" element={<SellerGuard><SellerDashboardPage /></SellerGuard>} />

          {/* Customer protected routes */}
          <Route path="profile" element={<AuthGuard><ProfilePage /></AuthGuard>} />
          <Route path="playground" element={<AuthGuard><PlaygroundPage /></AuthGuard>} />
          <Route path="wardrobe" element={<AuthGuard><WardrobePage /></AuthGuard>} />
          <Route path="cart" element={<AuthGuard><CartPage /></AuthGuard>} />
          <Route path="checkout" element={<AuthGuard><CheckoutPage /></AuthGuard>} />
          <Route path="orders" element={<AuthGuard><OrdersPage /></AuthGuard>} />
          <Route path="orders/:id" element={<AuthGuard><OrderTrackingPage /></AuthGuard>} />
          <Route path="notifications" element={<AuthGuard><NotificationsPage /></AuthGuard>} />
          <Route path="wishlist" element={<AuthGuard><WishlistPage /></AuthGuard>} />
          <Route path="credits" element={<AuthGuard><CreditsPage /></AuthGuard>} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
