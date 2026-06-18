import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/authStore';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '',
  timeout: 30000,
});

// 요청 인터셉터 - 토큰 자동 첨부
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 응답 인터셉터 - 토큰 만료 시 재발급
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) throw new Error('No refresh token');

        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`,
          { refreshToken }
        );

        const { accessToken } = res.data.data;
        useAuthStore.getState().setTokens(accessToken, refreshToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = '/auth/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// API 함수들
export const authApi = {
  register: (data: { email: string; password: string; name: string; phone?: string }) =>
    api.post('/api/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/api/auth/login', data),
  kakaoLogin: (code: string) =>
    api.post('/api/auth/oauth/kakao', { code }),
  googleLogin: (code: string) =>
    api.post('/api/auth/oauth/google', { code }),
  naverLogin: (code: string, state: string) =>
    api.post('/api/auth/oauth/naver', { code, state }),
  verifyBusiness: (data: object) =>
    api.post('/api/auth/verify-business', data),
  getMe: () =>
    api.get('/api/auth/me'),
  logout: (refreshToken: string) =>
    api.post('/api/auth/logout', { refreshToken }),
  updateProfile: (data: object) =>
    api.put('/api/auth/profile', data),
};

export const storeApi = {
  getMyStore: () => api.get('/api/seller/store'),
  createStore: (data: object) => api.post('/api/seller/store', data),
  updateStore: (data: FormData) =>
    api.put('/api/seller/store', data, { headers: { 'Content-Type': undefined } }),
  updateTheme: (data: object) => api.put('/api/seller/store/theme', data),
  updateShipping: (data: object) => api.put('/api/seller/store/shipping', data),
  addBanner: (data: FormData) =>
    api.post('/api/seller/store/banners', data, { headers: { 'Content-Type': undefined } }),
  deleteBanner: (bannerId: string) => api.delete(`/api/seller/store/banners/${bannerId}`),
  reorderBanners: (bannerIds: string[]) => api.put('/api/seller/store/banners/reorder', { bannerIds }),
  getPopups: () => api.get('/api/seller/store/popup'),
  createPopup: (data: FormData) =>
    api.post('/api/seller/store/popup', data, { headers: { 'Content-Type': undefined } }),
  updatePopup: (popupId: string, data: FormData) =>
    api.put(`/api/seller/store/popup/${popupId}`, data, { headers: { 'Content-Type': undefined } }),
  deletePopup: (popupId: string) => api.delete(`/api/seller/store/popup/${popupId}`),
  updatePopupDisplayMode: (displayMode: string) =>
    api.put('/api/seller/store/popup/display-mode', { displayMode }),
};

export const productApi = {
  getProducts: (params?: object) => api.get('/api/seller/products', { params }),
  getProduct: (id: string) => api.get(`/api/seller/products/${id}`),
  createProduct: (data: FormData) =>
    api.post('/api/seller/products', data, { headers: { 'Content-Type': undefined } }),
  updateProduct: (id: string, data: FormData) =>
    api.put(`/api/seller/products/${id}`, data, { headers: { 'Content-Type': undefined } }),
  deleteProduct: (id: string) => api.delete(`/api/seller/products/${id}`),
  toggleStatus: (id: string) => api.patch(`/api/seller/products/${id}/toggle`),
  getCategories: () => api.get('/api/seller/products/categories'),
  // 스토어 전용 카테고리
  getStoreCategories: () => api.get('/api/seller/products/store-categories/list'),
  createStoreCategory: (data: { name: string; icon?: string }) => api.post('/api/seller/products/store-categories', data),
  updateStoreCategory: (id: string, data: object) => api.put(`/api/seller/products/store-categories/${id}`, data),
  deleteStoreCategory: (id: string) => api.delete(`/api/seller/products/store-categories/${id}`),
};

export const orderApi = {
  getOrders: (params?: object) => api.get('/api/seller/orders', { params }),
  getOrder: (id: string) => api.get(`/api/seller/orders/${id}`),
  updateStatus: (id: string, data: object) => api.patch(`/api/seller/orders/${id}/status`, data),
  processRefund: (id: string, data: object) => api.post(`/api/seller/orders/${id}/refund`, data),
  bulkStatusUpdate: (data: object) => api.post('/api/seller/orders/bulk-status', data),
  bulkShipping: (data: object) => api.post('/api/seller/orders/bulk-shipping', data),
  getSummary: () => api.get('/api/seller/orders/summary'),
};

export const courierApi = {
  getAccounts: () => api.get('/api/seller/courier'),
  createAccount: (data: object) => api.post('/api/seller/courier', data),
  updateAccount: (accountId: string, data: object) => api.put(`/api/seller/courier/${accountId}`, data),
  deleteAccount: (accountId: string) => api.delete(`/api/seller/courier/${accountId}`),
  setDefault: (accountId: string) => api.patch(`/api/seller/courier/${accountId}/default`),
};

export const analyticsApi = {
  getDashboard: () => api.get('/api/seller/analytics/dashboard'),
  getSalesChart: (period: string) => api.get('/api/seller/analytics/sales-chart', { params: { period } }),
  getProductAnalytics: (period: string) => api.get('/api/seller/analytics/products', { params: { period } }),
  getSettlements: (params?: object) => api.get('/api/seller/analytics/settlements', { params }),
  getNotifications: () => api.get('/api/seller/analytics/notifications'),
  markNotificationsRead: () => api.post('/api/seller/analytics/notifications/read'),
};

export const sellerReviewApi = {
  getReviews: (params?: object) => api.get('/api/public/seller/reviews', { params }),
  replyToReview: (id: string, reply: string) => api.patch(`/api/public/seller/reviews/${id}/reply`, { reply }),
};

export const sellerQnaApi = {
  getQnAs: (params?: object) => api.get('/api/public/seller/qna', { params }),
  answerQnA: (id: string, answer: string) => api.patch(`/api/public/seller/qna/${id}/answer`, { answer }),
};

export const sellerChatbotApi = {
  getFaqs: () => api.get('/api/public/seller/chatbot'),
  createFaq: (data: { question: string; answer: string }) => api.post('/api/public/seller/chatbot', data),
  updateFaq: (id: string, data: object) => api.patch(`/api/public/seller/chatbot/${id}`, data),
  deleteFaq: (id: string) => api.delete(`/api/public/seller/chatbot/${id}`),
};
