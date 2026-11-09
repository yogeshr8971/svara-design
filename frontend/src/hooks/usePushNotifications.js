import { useCallback, useEffect, useState } from 'react';
import * as notificationService from '../services/notificationService';

const b64ToUint8 = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

/**
 * Web Push lifecycle. Push can only be delivered if the person grants permission,
 * and on iPhone/iPad only after the site is installed to the Home Screen (iOS 16.4+).
 */
export default function usePushNotifications(enabledForUser) {
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const [permission, setPermission] = useState(supported ? Notification.permission : 'unsupported');
  const [subscribed, setSubscribed] = useState(false);
  const [serverEnabled, setServerEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const needsInstall = supported && isIOS() && !isStandalone();

  useEffect(() => {
    if (!supported || !enabledForUser) return;
    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(Boolean(sub));
      // Keep the server in sync (the endpoint can be re-assigned to this user after a login switch).
      if (sub && Notification.permission === 'granted') notificationService.subscribePush(sub.toJSON()).catch(() => {});
    }).catch(() => {});
  }, [supported, enabledForUser]);

  const enable = useCallback(async () => {
    if (!supported) return false;
    setBusy(true);
    try {
      const cfg = await notificationService.pushConfig();
      if (!cfg.enabled) { setServerEnabled(false); return false; }
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return false;
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(cfg.publicKey) }));
      await notificationService.subscribePush(sub.toJSON());
      setSubscribed(true);
      return true;
    } finally {
      setBusy(false);
    }
  }, [supported]);

  const disable = useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await notificationService.unsubscribePush(sub.endpoint).catch(() => {});
      await sub.unsubscribe();
    }
    setSubscribed(false);
  }, []);

  return { supported, permission, subscribed, serverEnabled, busy, needsInstall, enable, disable };
}
