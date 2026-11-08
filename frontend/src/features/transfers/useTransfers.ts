import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Paginated, TransferDetail, TransferListRow, TransferStatus, TransferSummary } from '../../types/api';

export interface TransferFilters {
  status: TransferStatus | '';
  direction: '' | 'incoming' | 'outgoing';
  search: string;
  page: number;
}

export function useTransfers(filters: TransferFilters) {
  return useQuery({
    queryKey: ['transfers', 'list', filters],
    queryFn: async () =>
      (
        await api.get<Paginated<TransferListRow>>('/transfers', {
          params: {
            page: filters.page,
            pageSize: 15,
            ...(filters.status && { status: filters.status }),
            ...(filters.direction && { direction: filters.direction }),
            ...(filters.search && { search: filters.search }),
          },
        })
      ).data,
    placeholderData: keepPreviousData,
    meta: { silent: true },
  });
}

export function useTransfer(id: string | undefined) {
  return useQuery({
    queryKey: ['transfers', 'detail', id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get<TransferDetail>(`/transfers/${id}`)).data,
    meta: { silent: true },
  });
}

/** Counts for the dashboard and the sidebar badge. Refreshes every minute. */
export function useTransferSummary() {
  return useQuery({
    queryKey: ['transfers', 'summary'],
    queryFn: async () => (await api.get<TransferSummary>('/transfers/summary')).data,
    refetchInterval: 60_000,
    meta: { silent: true },
  });
}

/** After any change, transfers AND stock numbers are out of date. */
function useRefresh() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['transfers'] }),
      queryClient.invalidateQueries({ queryKey: ['stock'] }),
    ]);
}

export interface TransferInput {
  id?: string;
  toLocationId: string;
  items: Array<{ productId: string; quantity: number }>;
  note: string | null;
}

/** Create a draft, or edit one. The form shows the errors itself, so no automatic toast. */
export function useSaveTransfer() {
  const refresh = useRefresh();
  return useMutation({
    meta: { silent: true },
    mutationFn: async ({ id, ...body }: TransferInput): Promise<TransferDetail> =>
      id ? (await api.patch<TransferDetail>(`/transfers/${id}`, body)).data : (await api.post<TransferDetail>('/transfers', body)).data,
    onSuccess: refresh,
  });
}

/** Errors from these show as a toast automatically (for example "not enough stock"). */
export function useSendTransfer() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<TransferDetail>(`/transfers/${id}/send`)).data,
    onSuccess: refresh,
  });
}

export function useCancelTransfer() {
  const refresh = useRefresh();
  return useMutation({
    meta: { silent: true }, // the cancel dialog shows its own errors
    mutationFn: async ({ id, reason }: { id: string; reason: string | null }) =>
      (await api.post<TransferDetail>(`/transfers/${id}/cancel`, { reason })).data,
    onSuccess: refresh,
  });
}

export function useReceiveTransfer() {
  const refresh = useRefresh();
  return useMutation({
    meta: { silent: true }, // the receive dialog shows its own errors
    mutationFn: async ({ id, items, note }: { id: string; items: Array<{ productId: string; quantityReceived: number }>; note: string | null }) =>
      (await api.post<TransferDetail>(`/transfers/${id}/receive`, { items, note })).data,
    onSuccess: refresh,
  });
}
