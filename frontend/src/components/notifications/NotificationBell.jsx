import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bell, BellRing, Check, Smartphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import usePushNotifications from '../../hooks/usePushNotifications';
import { formatDate } from '../../utils/formatDate';
import toast from 'react-hot-toast';

export function PushPrompt({ compact = false }) {
  const { user } = useAuth();
  const push = usePushNotifications(Boolean(user));
  if (!push.supported || push.permission === 'denied' || (push.subscribed && push.permission === 'granted')) {
    if (push.permission === 'denied') return <p className="px-4 py-2 text-[11px] text-charcoal-400">Alerts are blocked in your browser settings. Enable notifications for this site to get order updates when SVARA is closed.</p>;
    return null;
  }
  if (push.needsInstall) {
    return (
      <p className="px-4 py-3 text-[11px] text-charcoal-500 flex gap-2 shrink-0"><Smartphone size={14} className="shrink-0 mt-0.5" />
        On iPhone, tap Share → “Add to Home Screen”, then open SVARA from the Home Screen to turn on alerts.</p>
    );
  }
  if (!push.serverEnabled) return null;
  return (
    <button
      disabled={push.busy}
      onClick={async () => { (await push.enable()) ? toast.success('Alerts on — we\u2019ll notify you even when SVARA is closed.') : toast.error('Alerts were not enabled.'); }}
      className={`w-full flex items-center gap-2 text-left text-xs font-semibold text-champagne-700 bg-champagne-100/70 hover:bg-champagne-100 shrink-0 ${compact ? 'px-3 py-2 rounded-xl' : 'px-4 py-3'}`}
    >
      <BellRing size={14} className="shrink-0" /> Turn on alerts for order & approval updates
    </button>
  );
}

export default function NotificationBell() {
  const { notifications, unread, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const go = (n) => {
    if (!n.readAt) markRead(n._id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} className="relative p-2 rounded-full hover:bg-white/50 text-charcoal-600">
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-burgundy-500 text-white text-[10px] font-bold grid place-items-center">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="fixed left-3 right-3 top-[76px] max-h-[calc(100dvh-100px)] flex flex-col md:absolute md:right-0 md:left-auto md:top-full md:mt-3 md:w-[380px] bg-white rounded-2xl shadow-glass-lg border border-white/60 overflow-hidden z-[60]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-ivory-300/40 shrink-0">
            <h3 className="font-display font-bold text-charcoal-700">Notifications</h3>
            {unread > 0 && <button onClick={markAllRead} className="text-[11px] font-semibold text-champagne-700 flex items-center gap-1"><Check size={12} /> Mark all read</button>}
          </div>
          <PushPrompt />
          <ul className="max-h-[60vh] overflow-y-auto divide-y divide-ivory-300/30 min-h-0">
            {notifications.length === 0 && <li className="px-4 py-10 text-center text-xs text-charcoal-400">You're all caught up.</li>}
            {notifications.slice(0, 12).map((n) => (
              <li key={n._id}>
                <button onClick={() => go(n)} className={`w-full text-left px-4 py-3 hover:bg-white/60 flex gap-3 ${n.readAt ? '' : 'bg-champagne-50/60'}`}>
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.readAt ? 'bg-transparent' : 'bg-burgundy-500'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-charcoal-700 break-words min-w-0">{n.title}</span>
                    <span className="block text-xs text-charcoal-500 break-words min-w-0">{n.message}</span>
                    <span className="block text-[10px] text-charcoal-300 mt-1">{formatDate(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block text-center text-xs font-semibold text-charcoal-600 py-3 border-t border-ivory-300/40 hover:bg-white/60 shrink-0">View all</Link>
        </div>
      )}
    </div>
  );
}
