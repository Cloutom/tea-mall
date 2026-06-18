import { Request } from 'express';

export interface AuthRequest extends Request {
  seller?: {
    id: string;
    email: string;
    name: string;
    businessVerified: boolean;
  };
}

export interface JwtPayload {
  sellerId: string;
  email: string;
  name: string;
  businessVerified: boolean;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
