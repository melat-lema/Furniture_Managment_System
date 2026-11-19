import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { SettingRecord } from '../../types/api';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get<SettingRecord[]>('/settings')).data,
    meta: { silent: true },
  });
}

export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: async (values: Partial<Record<SettingRecord['key'], number>>) =>
      (await api.patch<SettingRecord[]>('/settings', values)).data,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['settings'] }),
        queryClient.invalidateQueries({ queryKey: ['stock'] }),
      ]),
  });
}
