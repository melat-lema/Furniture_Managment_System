import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toApiError } from './errors';
import { notifyError } from './notify';

/**
 * Default error handling for ALL data loading and saving:
 *  - failed loads and saves show a toast automatically,
 *  - a query can opt out with  meta: { silent: true }  when it shows its own error UI,
 *  - temporary problems (no internet, 5xx) are retried twice; other errors are not retried.
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.silent) return;
      notifyError(error, 'Could not load data');
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => notifyError(error, 'Could not save your changes'),
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const apiError = toApiError(error);
        return (apiError.isNetwork || apiError.isServer) && failureCount < 2;
      },
    },
  },
});
