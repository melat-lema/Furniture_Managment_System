import { useQuery } from '@tanstack/react-query';
import { CircleCheck, LoaderCircle, RefreshCw, ServerOff } from 'lucide-react';
import { api } from '../lib/api';
import { toApiError } from '../lib/errors';

interface HealthResponse {
  status: string;
  time: string;
}

/** Shows live whether the API and database are reachable. A good example of handling a query error inline. */
export default function ConnectionStatus() {
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: ['health'],
    queryFn: async () => (await api.get<HealthResponse>('/health')).data,
    meta: { silent: true }, // this card shows its own error, so no toast
    retry: false,
  });

  const apiError = error ? toApiError(error) : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-ink-900 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {isPending ? (
            <LoaderCircle className="mt-0.5 h-5 w-5 animate-spin text-zinc-400" aria-hidden="true" />
          ) : apiError ? (
            <ServerOff className="mt-0.5 h-5 w-5 text-red-400" aria-hidden="true" />
          ) : (
            <CircleCheck className="mt-0.5 h-5 w-5 text-emerald-400" aria-hidden="true" />
          )}
          <div>
            <p className="text-sm font-semibold text-zinc-100">
              {isPending ? 'Checking the system…' : apiError ? 'System unreachable' : 'System online'}
            </p>
            <p className="mt-0.5 text-sm text-zinc-500">
              {apiError
                ? apiError.message
                : data
                  ? 'The server and database are responding normally.'
                  : 'Contacting the server…'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw className={isFetching ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} aria-hidden="true" />
          Check again
        </button>
      </div>
    </div>
  );
}
