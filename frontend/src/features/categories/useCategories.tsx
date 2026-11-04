import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { CategoryRecord } from '../../types/api';

const KEY = ['categories'] as const;

export function useCategories() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<CategoryRecord[]>('/categories')).data,
    staleTime: 60_000,
    meta: { silent: true },
  });
}

export function useSaveCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: async ({ id, name }: { id?: string; name: string }) =>
      id ? (await api.patch(`/categories/${id}`, { name })).data : (await api.post('/categories', { name })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/categories/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
