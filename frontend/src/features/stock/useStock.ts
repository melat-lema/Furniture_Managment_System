import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type {
  MovementReason,
  MovementRow,
  Paginated,
  ProductionResult,
  StockLevelsPage,
  StockOverviewPage,
  StockSummary,
} from '../../types/api';

export function useStockSummary() {
  return useQuery({
    queryKey: ['stock', 'summary'],
    queryFn: async () => (await api.get<StockSummary>('/stock/summary')).data,
    meta: { silent: true },
  });
}

export interface LevelsFilters {
  locationId: string;
  search: string;
  categoryId: string;
  lowOnly: boolean;
  page: number;
}

export function useStockLevels(filters: LevelsFilters, enabled = true) {
  return useQuery({
    queryKey: ['stock', 'levels', filters],
    enabled,
    queryFn: async () =>
      (
        await api.get<StockLevelsPage>('/stock/levels', {
          params: {
            page: filters.page,
            pageSize: 15,
            ...(filters.locationId && { locationId: filters.locationId }),
            ...(filters.search && { search: filters.search }),
            ...(filters.categoryId && { categoryId: filters.categoryId }),
            ...(filters.lowOnly && { lowOnly: true }),
          },
        })
      ).data,
    placeholderData: keepPreviousData,
    meta: { silent: true },
  });
}

export interface OverviewFilters {
  search: string;
  categoryId: string;
  page: number;
}

export function useStockOverview(filters: OverviewFilters, enabled = true) {
  return useQuery({
    queryKey: ['stock', 'overview', filters],
    enabled,
    queryFn: async () =>
      (
        await api.get<StockOverviewPage>('/stock/overview', {
          params: {
            page: filters.page,
            pageSize: 15,
            ...(filters.search && { search: filters.search }),
            ...(filters.categoryId && { categoryId: filters.categoryId }),
          },
        })
      ).data,
    placeholderData: keepPreviousData,
    meta: { silent: true },
  });
}

export interface MovementFilters {
  locationId: string;
  productId: string;
  reason: MovementReason | '';
  page: number;
}

export function useStockMovements(filters: MovementFilters) {
  return useQuery({
    queryKey: ['stock', 'movements', filters],
    queryFn: async () =>
      (
        await api.get<Paginated<MovementRow>>('/stock/movements', {
          params: {
            page: filters.page,
            pageSize: 15,
            ...(filters.locationId && { locationId: filters.locationId }),
            ...(filters.productId && { productId: filters.productId }),
            ...(filters.reason && { reason: filters.reason }),
          },
        })
      ).data,
    placeholderData: keepPreviousData,
    meta: { silent: true },
  });
}

export interface ProductionInput {
  items: Array<{ productId: string; quantity: number }>;
  note: string | null;
  locationId?: string;
}

function useInvalidateStock() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['stock'] });
}

export function useRecordProduction() {
  const invalidate = useInvalidateStock();
  return useMutation({
    meta: { silent: true }, // the form shows its own errors
    mutationFn: async (input: ProductionInput) => (await api.post<ProductionResult>('/stock/production', input)).data,
    onSuccess: invalidate,
  });
}

export interface AdjustInput {
  productId: string;
  locationId?: string;
  quantity: number;
  reason: 'DAMAGED' | 'MISCOUNT' | 'FOUND' | 'OTHER';
  note: string | null;
}

export function useAdjustStock() {
  const invalidate = useInvalidateStock();
  return useMutation({
    meta: { silent: true },
    mutationFn: async (input: AdjustInput) =>
      (await api.post<{ productId: string; locationId: string; change: number; newQuantity: number }>('/stock/adjustments', input)).data,
    onSuccess: invalidate,
  });
}
