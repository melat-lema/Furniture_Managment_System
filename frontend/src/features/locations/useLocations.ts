import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { LocationType } from '../../types/auth';
import type { LocationRecord } from '../../types/api';

const KEY = ['locations'] as const;

export function useLocations() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<LocationRecord[]>('/locations')).data,
    meta: { silent: true }, // the page shows its own error panel
  });
}

export interface LocationInput {
  id?: string;
  name: string;
  type?: LocationType; // only when creating
  address: string | null;
  phone: string | null;
}

/** Used by the form: errors are shown inside the form, so no automatic toast. */
export function useSaveLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: async ({ id, ...body }: LocationInput) =>
      id ? (await api.patch(`/locations/${id}`, body)).data : (await api.post('/locations', body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

/** Activate / deactivate. Errors (for example "still holds stock") appear as a toast automatically. */
export function useSetLocationActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      (await api.patch(`/locations/${id}`, { isActive })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
