import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { PriceChange } from '../../types/api';

export function usePriceChanges(enabled: boolean) {
  return useQuery({
    queryKey: ['products', 'price-changes'],
    enabled,
    queryFn: async () => (await api.get<PriceChange[]>('/products/price-changes')).data,
    meta: { silent: true },
  });
}
