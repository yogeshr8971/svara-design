import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../ui/Spinner';

export default function SellerGuard({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Spinner size="lg" />
        <p className="mt-4 text-xs tracking-widest text-charcoal-400 uppercase">Validating Seller Credentials...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/seller/login" state={{ from: location }} replace />;
  }

  if (user.role !== 'seller' && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}
