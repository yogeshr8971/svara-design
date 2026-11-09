import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4 text-center">
        <div className="fixed inset-0 bg-charcoal-900/60 backdrop-blur-xs transition-opacity" onClick={onClose} />
        <div className={`relative w-full ${maxWidth} transform overflow-hidden rounded-3xl bg-white p-6 sm:p-8 text-left shadow-2xl transition-all border border-ivory-300 z-10 my-8`}>
          <div className="flex items-center justify-between pb-4 border-b border-ivory-200">
            <h3 className="font-display text-xl font-bold text-charcoal-800">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-charcoal-400 hover:bg-ivory-100 hover:text-charcoal-700 transition-colors"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
