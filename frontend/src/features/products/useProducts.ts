import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Paginated, ProductRecord } from '../../types/api';

export interface ProductFilters {
  search: string;
  categoryId: string;
  isActive: '' | 'true' | 'false';
  page: number;
}

export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: async () =>
      (
        await api.get<Paginated<ProductRecord>>('/products', {
          params: {
            page: filters.page,
            pageSize: 12,
            ...(filters.search && { search: filters.search }),
            ...(filters.categoryId && { categoryId: filters.categoryId }),
            ...(filters.isActive && { isActive: filters.isActive }),
          },
        })
      ).data,
    placeholderData: keepPreviousData,
    meta: { silent: true },
  });
}

export interface ProductInput {
  id?: string;
  name: string;
  sku: string;
  categoryId: string;
  price: number;
  material: string | null;
  dimensions: string | null;
  description: string | null;
  isPublished: boolean;
  isActive: boolean;
}

export function useSaveProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: async ({ id, ...body }: ProductInput): Promise<ProductRecord> =>
      id ? (await api.patch<ProductRecord>(`/products/${id}`, body)).data : (await api.post<ProductRecord>('/products', body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}

export async function uploadProductImage(id: string, file: File): Promise<ProductRecord> {
  const form = new FormData();
  form.append('file', file);
  // No Content-Type header on purpose: the browser adds it, with the multipart boundary.
  return (await api.post<ProductRecord>(`/products/${id}/image`, form, { timeout: 60_000 })).data;
}

export async function removeProductImage(id: string): Promise<ProductRecord> {
  return (await api.delete<ProductRecord>(`/products/${id}/image`)).data;
}
