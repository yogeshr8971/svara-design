import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';
import * as notificationService from '../services/notificationService';

const NotificationContext = createContext({ notifications: [], unread: 0 });
const POLL_MS = 30000;

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const lastTopId = useRef(null);

  const refresh = useCallback(async ({ announce = true } = {}) => {
    if (!user) return;
    try {
      const data = await notificationService.list({ limit: 30 });
      const top = data.notifications[0];
      if (announce && top && lastTopId.current && top._id !== lastTopId.current && !top.readAt && document.visibilityState === 'visible') {
        toast(top.title, { icon: '🔔' });
      }
      lastTopId.current = top?._id || null;
      setNotifications(data.notifications);
      setUnread(data.unread);
    } catch { /* offline or logged out — ignore */ }
  }, [user]);

  // Poll while the tab is visible; refresh instantly on focus. (Closed-tab delivery is handled by Web Push + email.)
  useEffect(() => {
    if (!user) { setNotifications([]); setUnread(0); lastTopId.current = null; return undefined; }
    refresh({ announce: false });
    const tick = () => document.visibilityState === 'visible' && refresh();
    const t = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); window.removeEventListener('focus', tick); };
  }, [user, refresh]);

  const markRead = useCallback(async (id) => {
    setNotifications((n) => n.map((x) => (x._id === id && !x.readAt ? { ...x, readAt: new Date().toISOString() } : x)));
    setUnread((u) => Math.max(0, u - 1));
    notificationService.markRead(id).catch(() => {});
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((n) => n.map((x) => ({ ...x, readAt: x.readAt || new Date().toISOString() })));
    setUnread(0);
    notificationService.markAllRead().catch(() => {});
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, unread, refresh, markRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
