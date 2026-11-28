import type { ChatReply, Page, ProductCard, SiteData } from './types';

/** In development this is "/api" (proxied to the backend). In production set VITE_API_URL. */
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api';

async function request<T>(path: string, init?: RequestInit, timeoutMs = 12_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface ProductQuery {
  category?: string;
  search?: string;
  sort?: 'new' | 'price_asc' | 'price_desc';
  page?: number;
  pageSize?: number;
}

export const publicApi = {
  site: () => request<SiteData>('/public/site'),
  products: (query: ProductQuery) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params.set(key, String(value));
    }
    return request<Page<ProductCard>>(`/public/products?${params.toString()}`);
  },
  chat: (message: string) => request<ChatReply>('/public/chat', { method: 'POST', body: JSON.stringify({ message }) }),
};
