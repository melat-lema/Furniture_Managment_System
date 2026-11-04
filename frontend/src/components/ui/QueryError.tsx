import { RefreshCw, ServerOff } from 'lucide-react';
import { toApiError } from '../../lib/errors';
import Button from './Button';

/** Shown in place of a list that failed to load, with a retry button. */
export default function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const apiError = toApiError(error);
  const reference = apiError.isServer && apiError.requestId ? ` (Ref: ${apiError.requestId.slice(0, 8)})` : '';

  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-red-500/20 bg-red-500/5 px-6 py-14 text-center">
      <ServerOff className="h-8 w-8 text-red-400" aria-hidden="true" />
      <h2 className="mt-4 text-lg font-semibold text-zinc-100">We could not load this</h2>
      <p className="mt-1 max-w-md text-sm text-zinc-400">
        {apiError.message}
        {reference}
      </p>
      <Button variant="secondary" className="mt-5" icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />} onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
