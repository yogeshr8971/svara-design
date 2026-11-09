import api from './api';

export const createOrder = async (body) => { const { data } = await api.post('/orders', body); return data; };
export const verifyPayment = async (orderId, body) => { const { data } = await api.post(`/orders/${orderId}/verify-payment`, body); return data; };
export const getOrders = async () => { const { data } = await api.get('/orders'); return data; };
export const getOrder = async (id) => { const { data } = await api.get(`/orders/${id}`); return data; };
export const cancelOrder = async (id, reason) => { const { data } = await api.post(`/orders/${id}/cancel`, { reason }); return data; };
export const getUpiDetails = async (id) => { const { data } = await api.get(`/orders/${id}/upi`); return data; };
export const submitUpiPayment = async (id, utr) => { const { data } = await api.post(`/orders/${id}/upi`, { utr }); return data; };
