import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/authStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  withCredentials: true,
});

// Access token 자동 첨부
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 시 refresh token으로 자동 갱신
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const res = await axios.post(`${API_URL}/api/consumer/auth/refresh`, {}, { withCredentials: true });
        const { accessToken } = res.data.data;
        const { consumer, setAuth } = useAuthStore.getState();
        if (consumer) setAuth(accessToken, consumer);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        useAuthStore.getState().clearAuth();
        if (typeof window !== 'undefined') window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

export const publicApi = {
  getAllStores: (params?: object) => api.get('/api/public/stores', { params }),
  getStore: (slug: string) => api.get(`/api/public/stores/${slug}`),
  getStorePopups: (slug: string) => api.get(`/api/public/stores/${slug}/popups`),
  getProducts: (slug: string, params?: object) => api.get(`/api/public/stores/${slug}/products`, { params }),
  getProduct: (id: string) => api.get(`/api/public/products/${id}`),
  search: (q: string) => api.get('/api/public/search', { params: { q } }),
  getProductsByTeaType: (teaType: string) => api.get('/api/public/tea-type', { params: { teaType } }),
  getCategories: () => api.get('/api/public/categories'),
  getProductsByCategory: (categoryId: string, params?: object) => api.get(`/api/public/categories/${categoryId}/products`, { params }),
  getProductReviews: (productId: string, params?: object) => api.get(`/api/public/products/${productId}/reviews`, { params }),
  getStoreQnAs: (slug: string, params?: object) => api.get(`/api/public/stores/${slug}/qna`, { params }),
  createQnA: (slug: string, data: object) => api.post(`/api/public/stores/${slug}/qna`, data),
  getStoreFaqs: (slug: string) => api.get(`/api/public/stores/${slug}/chatbot`),
};

export const paymentApi = {
  prepare: (data: object, token?: string) =>
    api.post('/api/payments/toss/prepare', data, token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  confirm: (data: object) => api.post('/api/payments/toss/confirm', data),
  lookupOrder: (data: object) => api.post('/api/payments/orders/lookup', data),
  cancelRequest: (data: object, token?: string) =>
    api.post('/api/payments/orders/cancel-request', data, token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
};

const authH = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

export const consumerAuthApi = {
  register: (data: { email: string; password: string; name: string; phone?: string }) =>
    api.post('/api/consumer/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/api/consumer/auth/login', data),
  me: (token: string) => api.get('/api/consumer/auth/me', authH(token)),
  refresh: () => api.post('/api/consumer/auth/refresh'),
  logout: (token: string) => api.post('/api/consumer/auth/logout', {}, authH(token)),
  getMyOrders: (token: string) => api.get('/api/consumer/auth/orders', authH(token)),
  updateProfile: (data: object, token: string) => api.patch('/api/consumer/auth/profile', data, authH(token)),
  sendEmailVerify: (token: string) => api.post('/api/consumer/auth/send-email-verify', {}, authH(token)),
  verifyEmail: (token: string) => api.post('/api/consumer/auth/verify-email', { token }),
};

export const reviewApi = {
  create: (data: FormData, token: string) =>
    api.post('/api/public/reviews', data, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
    }),
};

export const sellerReviewApi = {
  getAll: (token: string, params?: object) => api.get('/api/public/seller/reviews', { ...authH(token), params }),
  reply: (id: string, reply: string, token: string) => api.patch(`/api/public/seller/reviews/${id}/reply`, { reply }, authH(token)),
};

export const sellerQnaApi = {
  getAll: (token: string, params?: object) => api.get('/api/public/seller/qna', { ...authH(token), params }),
  answer: (id: string, answer: string, token: string) => api.patch(`/api/public/seller/qna/${id}/answer`, { answer }, authH(token)),
};

export const sellerChatbotApi = {
  getAll: (token: string) => api.get('/api/public/seller/chatbot', authH(token)),
  create: (data: object, token: string) => api.post('/api/public/seller/chatbot', data, authH(token)),
  update: (id: string, data: object, token: string) => api.patch(`/api/public/seller/chatbot/${id}`, data, authH(token)),
  delete: (id: string, token: string) => api.delete(`/api/public/seller/chatbot/${id}`, authH(token)),
};

export const addressApi = {
  getAll: (token: string) => api.get('/api/consumer/auth/addresses', authH(token)),
  create: (data: object, token: string) => api.post('/api/consumer/auth/addresses', data, authH(token)),
  update: (id: string, data: object, token: string) => api.put(`/api/consumer/auth/addresses/${id}`, data, authH(token)),
  delete: (id: string, token: string) => api.delete(`/api/consumer/auth/addresses/${id}`, authH(token)),
  setDefault: (id: string, token: string) => api.patch(`/api/consumer/auth/addresses/${id}/default`, {}, authH(token)),
};

export const billingApi = {
  getAll: (token: string) => api.get('/api/consumer/auth/billing', authH(token)),
  confirm: (data: { authKey: string }, token: string) => api.post('/api/consumer/auth/billing/confirm', data, authH(token)),
  delete: (id: string, token: string) => api.delete(`/api/consumer/auth/billing/${id}`, authH(token)),
  pay: (data: object, token: string) => api.post('/api/consumer/auth/billing/pay', data, authH(token)),
};

export const webAuthnApi = {
  getAll: (token: string) => api.get('/api/consumer/auth/webauthn', authH(token)),
  getRegisterOptions: (token: string) => api.post('/api/consumer/auth/webauthn/register-options', {}, authH(token)),
  register: (data: object, token: string) => api.post('/api/consumer/auth/webauthn/register', data, authH(token)),
  getAuthOptions: (token: string) => api.post('/api/consumer/auth/webauthn/auth-options', {}, authH(token)),
  auth: (data: object, token: string) => api.post('/api/consumer/auth/webauthn/auth', data, authH(token)),
  delete: (id: string, token: string) => api.delete(`/api/consumer/auth/webauthn/${id}`, authH(token)),
};

export default api;