import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { SalespersonRecord } from '../../types/api';

export interface SalespeopleParams {
  showroomId?: string;
  includeInactive?: boolean;
}

export function useSalespeople(params: SalespeopleParams = {}) {
  return useQuery({
    queryKey: ['salespeople', params],
    queryFn: async () =>
      (
        await api.get<SalespersonRecord[]>('/salespeople', {
          params: {
            ...(params.showroomId && { showroomId: params.showroomId }),
            ...(params.includeInactive && { includeInactive: true }),
          },
        })
      ).data,
    meta: { silent: true },
  });
}

export interface SalespersonInput {
  id?: string;
  fullName: string;
  phone: string | null;
  showroomId?: string;
}

/** Used by the form, which shows its own errors. */
export function useSaveSalesperson() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: async ({ id, ...body }: SalespersonInput) =>
      id
        ? (await api.patch<SalespersonRecord>(`/salespeople/${id}`, { fullName: body.fullName, phone: body.phone })).data
        : (await api.post<SalespersonRecord>('/salespeople', body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['salespeople'] }),
  });
}

export function useSetSalespersonActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      (await api.patch<SalespersonRecord>(`/salespeople/${id}`, { isActive })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['salespeople'] }),
  });
}
