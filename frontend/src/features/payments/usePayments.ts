import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Paginated, PaymentMethod, PaymentRow, PaymentsSummary, VerificationStatus } from '../../types/api';

export interface PaymentFilters {
  status: VerificationStatus | '';
  method: PaymentMethod | '';
  overdue: boolean;
  locationId: string;
  search: string;
  page: number;
}

export function usePayments(filters: PaymentFilters) {
  return useQuery({
    queryKey: ['payments', 'list', filters],
    queryFn: async () =>
      (
        await api.get<Paginated<PaymentRow>>('/payments', {
          params: {
            page: filters.page,
            pageSize: 15,
            ...(filters.status && { status: filters.status }),
            ...(filters.method && { method: filters.method }),
            ...(filters.overdue && { overdue: true }),
            ...(filters.locationId && { locationId: filters.locationId }),
            ...(filters.search && { search: filters.search }),
          },
        })
      ).data,
    placeholderData: keepPreviousData,
    meta: { silent: true },
  });
}

/** Counts for the dashboard and the sidebar badge. Refreshes every minute. */
export function usePaymentsSummary(enabled = true) {
  return useQuery({
    queryKey: ['payments', 'summary'],
    enabled,
    queryFn: async () => (await api.get<PaymentsSummary>('/payments/summary')).data,
    refetchInterval: 60_000,
    meta: { silent: true },
  });
}

/** After a decision the queue, the sale and the dashboards are all out of date. */
function useRefresh() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['payments'] }),
      queryClient.invalidateQueries({ queryKey: ['sales'] }),
    ]);
}

export function useVerifyPayment() {
  const refresh = useRefresh();
  return useMutation({
    meta: { silent: true }, // the dialog shows its own errors
    mutationFn: async (id: string) => (await api.post<PaymentRow>(`/payments/${id}/verify`)).data,
    onSuccess: refresh,
  });
}

export function useRejectPayment() {
  const refresh = useRefresh();
  return useMutation({
    meta: { silent: true },
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await api.post<PaymentRow>(`/payments/${id}/reject`, { reason })).data,
    onSuccess: refresh,
  });
}

export function useBulkVerify() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (ids: string[]) => (await api.post<{ verified: number; skipped: number }>('/payments/bulk-verify', { ids })).data,
    onSuccess: refresh,
  });
}
