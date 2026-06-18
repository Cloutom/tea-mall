import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Seller } from '@/types';

interface AuthState {
  seller: Seller | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  setSeller: (seller: Seller) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  login: (seller: Seller, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  updateSeller: (data: Partial<Seller>) => void;
  setHasHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      seller: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      _hasHydrated: false,
      setSeller: (seller) => set({ seller }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      login: (seller, accessToken, refreshToken) =>
        set({ seller, accessToken, refreshToken, isAuthenticated: true }),
      logout: () =>
        set({ seller: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
      updateSeller: (data) =>
        set((state) => ({
          seller: state.seller ? { ...state.seller, ...data } : null,
        })),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'tea-mall-seller-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        seller: state.seller,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
