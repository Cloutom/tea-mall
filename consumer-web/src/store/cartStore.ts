import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  originalPrice?: number | null;
  thumbnail?: string | null;
  unit: string;
  stock: number;
  quantity: number;
  storeSlug: string;
  storeName: string;
  selectedOption?: string;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (productId: string, selectedOption?: string) => void;
  updateQuantity: (productId: string, quantity: number, selectedOption?: string) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item, quantity = 1) => {
        set((state) => {
          const existing = state.items.find((i) => i.productId === item.productId && i.selectedOption === item.selectedOption);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === item.productId && i.selectedOption === item.selectedOption
                  ? { ...i, quantity: Math.min(i.quantity + quantity, i.stock) }
                  : i
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity: Math.min(quantity, item.stock) }] };
        });
      },
      removeItem: (productId, selectedOption?: string) => set((s) => ({
        items: s.items.filter((i) => !(i.productId === productId && i.selectedOption === selectedOption))
      })),
      updateQuantity: (productId, quantity, selectedOption?: string) => {
        if (quantity <= 0) {
          set((s) => ({ items: s.items.filter((i) => !(i.productId === productId && i.selectedOption === selectedOption)) }));
          return;
        }
        set((s) => ({ items: s.items.map((i) => i.productId === productId && i.selectedOption === selectedOption ? { ...i, quantity: Math.min(quantity, i.stock) } : i) }));
      },
      clearCart: () => set({ items: [] }),
      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      totalPrice: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    { name: 'tea-mall-cart' }
  )
);
