import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Consumer {
  id: string;
  email: string;
  name: string;
  phone?: string;
}

interface AuthState {
  accessToken: string | null;
  consumer: Consumer | null;
  setAuth: (token: string, consumer: Consumer) => void;
  clearAuth: () => void;
  updateConsumer: (consumer: Consumer) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      consumer: null,
      setAuth: (token, consumer) => set({ accessToken: token, consumer }),
      clearAuth: () => set({ accessToken: null, consumer: null }),
      updateConsumer: (consumer) => set({ consumer }),
    }),
    {
      name: 'tea-mall-consumer-auth',
      partialize: (state) => ({ accessToken: state.accessToken, consumer: state.consumer }),
    }
  )
);