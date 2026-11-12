import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import Spinner from '../ui/Spinner';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col justify-between">
      <Navbar />
      <main className="flex-1 pt-24">
        <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
