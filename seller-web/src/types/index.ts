export interface Seller {
  id: string;
  email: string;
  name: string;
  phone?: string;
  profileImageUrl?: string;
  businessNumber?: string;
  businessName?: string;
  businessOwner?: string;
  businessAddress?: string;
  businessType?: string;
  businessCategory?: string;
  businessVerified: boolean;
  businessVerifiedAt?: string;
  store?: Store | null;
  createdAt: string;
}

export interface Store {
  id: string;
  sellerId: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  themeColor: string;
  accentColor: string;
  backgroundColor: string;
  fontFamily: string;
  layoutType: 'grid' | 'list' | 'magazine';
  bannerType: 'image' | 'video' | 'slideshow';
  isOpen: boolean;
  openMessage?: string;
  closedMessage?: string;
  shippingPolicy?: string;
  returnPolicy?: string;
  minOrderAmount?: number;
  instagramUrl?: string;
  naverBlogUrl?: string;
  youtubeUrl?: string;
  totalViews: number;
  banners: StoreBanner[];
  _count?: { products: number; orders: number; reviews: number };
}

export interface StoreBanner {
  id: string;
  imageUrl: string;
  linkUrl?: string;
  title?: string;
  order: number;
  isActive: boolean;
}

export interface Product {
  id: string;
  storeId: string;
  categoryId?: string;
  category?: Category;
  name: string;
  description?: string;
  detailHtml?: string;
  price: number;
  originalPrice?: number;
  discountRate?: number;
  stock: number;
  unit: string;
  weight?: number;
  images: string[];
  thumbnail?: string;
  teaOrigin?: string;
  teaType?: string;
  caffeineLevel?: string;
  brewingTemp?: string;
  brewingTime?: string;
  harvestSeason?: string;
  processingMethod?: string;
  liquidColor?: string;
  body?: string;
  aroma?: string;
  flavorBitter?: number;
  flavorSweet?: number;
  flavorAstringent?: number;
  flavorSavory?: number;
  flavorFloral?: number;
  recommendedTime?: string;
  isSignature: boolean;
  tags: string[];
  isActive: boolean;
  isFeatured: boolean;
  totalViews: number;
  totalSales: number;
  totalRevenue: number;
  createdAt: string;
  _count?: { orderItems: number; impressions: number; reviews: number };
}

export interface Category {
  id: string;
  name: string;
  nameEn?: string;
  icon?: string;
  children?: Category[];
}

export interface Order {
  id: string;
  orderNumber: string;
  storeId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address: string;
  addressDetail?: string;
  deliveryMemo?: string;
  status: OrderStatus;
  totalAmount: number;
  shippingFee: number;
  discountAmount: number;
  finalAmount: number;
  paymentMethod?: string;
  paidAt?: string;
  trackingNumber?: string;
  courier?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancelReason?: string;
  cancelledAt?: string;
  memo?: string;
  createdAt: string;
  items: OrderItem[];
}

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'SHIPPING'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUND_REQ'
  | 'REFUNDED';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product?: { id: string; name: string; thumbnail?: string };
}

export interface DashboardStats {
  today: { sales: number; orders: number; impressions: number };
  month: { sales: number; orders: number; impressions: number; growth: number };
  totals: { orders: number; pendingOrders: number; products: number; storeViews: number };
  recentOrders: Order[];
  topProducts: Product[];
}

export interface SalesChartData {
  date: string;
  sales: number;
  orders: number;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export interface Settlement {
  id: string;
  period: string;
  totalSales: number;
  platformFee: number;
  paymentFee: number;
  netAmount: number;
  status: string;
  settledAt?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  pagination?: Pagination;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
