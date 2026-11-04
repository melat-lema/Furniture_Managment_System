import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toApiError } from './errors';
import { notifyError } from './notify';

/**
 * Default error handling for ALL data loading and saving:
 *  - failed loads and saves show a toast automatically,
 *  - a query or mutation can opt out with  meta: { silent: true }  when it shows its own error UI
 *    (forms do this, because they put errors under the fields),
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
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.silent) return;
      notifyError(error, 'Could not complete that action');
    },
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
