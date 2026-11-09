import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { PushPrompt } from '../components/notifications/NotificationBell';
import { formatDate } from '../utils/formatDate';

export default function NotificationsPage() {
  const { notifications, unread, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-champagne-600">Updates</span>
          <h1 className="section-heading text-3xl font-bold">Notifications</h1>
        </div>
        {unread > 0 && <button onClick={markAllRead} className="text-xs font-semibold text-champagne-700">Mark all read</button>}
      </div>
      <div className="glass rounded-2xl overflow-hidden"><PushPrompt /></div>
      <div className="glass rounded-3xl divide-y divide-ivory-300/40 overflow-hidden">
        {notifications.length === 0 && (
          <div className="p-14 text-center text-sm text-charcoal-400"><Bell className="mx-auto mb-3" /> Nothing here yet.</div>
        )}
        {notifications.map((n) => (
          <button key={n._id} onClick={() => { if (!n.readAt) markRead(n._id); if (n.link) navigate(n.link); }}
            className={`w-full text-left p-4 flex gap-3 hover:bg-white/60 ${n.readAt ? '' : 'bg-champagne-50/60'}`}>
            <span className={`mt-2 w-2 h-2 rounded-full shrink-0 ${n.readAt ? 'bg-transparent' : 'bg-burgundy-500'}`} />
            <span>
              <span className="block text-sm font-semibold text-charcoal-700">{n.title}</span>
              <span className="block text-sm text-charcoal-500">{n.message}</span>
              <span className="block text-[11px] text-charcoal-300 mt-1">{formatDate(n.createdAt)}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
