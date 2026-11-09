import api from './api';

export const list = async (params = {}) => (await api.get('/notifications', { params })).data;
export const unreadCount = async () => (await api.get('/notifications/unread-count')).data;
export const markRead = async (id) => (await api.post(`/notifications/${id}/read`)).data;
export const markAllRead = async () => (await api.post('/notifications/read-all')).data;
export const pushConfig = async () => (await api.get('/notifications/push/config')).data;
export const subscribePush = async (subscription) => (await api.post('/notifications/push/subscribe', subscription)).data;
export const unsubscribePush = async (endpoint) => (await api.post('/notifications/push/unsubscribe', { endpoint })).data;
