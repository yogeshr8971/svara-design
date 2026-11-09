import express from 'express';
import { protect } from '../middleware/auth.js';
import * as c from '../controllers/notificationController.js';

const router = express.Router();
router.use(protect);
router.get('/', c.listNotifications);
router.get('/unread-count', c.unreadCount);
router.post('/read-all', c.markAllRead);
router.post('/:id/read', c.markRead);
router.get('/push/config', c.pushConfig);
router.post('/push/subscribe', c.subscribePush);
router.post('/push/unsubscribe', c.unsubscribePush);
export default router;
