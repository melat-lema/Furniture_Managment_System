import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Role } from '../../types/auth';
import type { Paginated, UserRecord } from '../../types/api';

export interface UserFilters {
  search: string;
  role: Role | '';
  isActive: '' | 'true' | 'false';
  page: number;
}

export function useUsers(filters: UserFilters) {
  return useQuery({
    queryKey: ['users', filters],
    queryFn: async () =>
      (
        await api.get<Paginated<UserRecord>>('/users', {
          params: {
            page: filters.page,
            pageSize: 15,
            ...(filters.search && { search: filters.search }),
            ...(filters.role && { role: filters.role }),
            ...(filters.isActive && { isActive: filters.isActive }),
          },
        })
      ).data,
    placeholderData: keepPreviousData, // keep showing the old rows while the next page loads
    meta: { silent: true },
  });
}

export interface UserInput {
  id?: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: Role;
  locationId: string | null;
  telegramChatId: string | null;
}

export interface CreatedUser {
  user: UserRecord;
  temporaryPassword: string;
}

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['users'] });
}

export function useSaveUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    meta: { silent: true },
    mutationFn: async ({ id, ...body }: UserInput): Promise<CreatedUser | UserRecord> =>
      id ? (await api.patch<UserRecord>(`/users/${id}`, body)).data : (await api.post<CreatedUser>('/users', body)).data,
    onSuccess: invalidate,
  });
}

export function useSetUserActive() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      (await api.patch<UserRecord>(`/users/${id}/active`, { isActive })).data,
    onSuccess: invalidate,
  });
}

export function useResetPassword() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<{ temporaryPassword: string }>(`/users/${id}/reset-password`)).data,
    onSuccess: invalidate,
  });
}

export function useForceLogout() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<{ signedOut: number }>(`/users/${id}/force-logout`)).data,
    onSuccess: invalidate,
  });
}

export function useUnlockUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/users/${id}/unlock`);
    },
    onSuccess: invalidate,
  });
}
