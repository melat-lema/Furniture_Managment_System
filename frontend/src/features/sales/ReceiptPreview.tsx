import { useQuery } from '@tanstack/react-query';
import { ExternalLink, LoaderCircle, RefreshCw } from 'lucide-react';
import Button from '../../components/ui/Button';
import { toApiError } from '../../lib/errors';
import { fetchReceiptLink } from './useSales';

/**
 * Shows a receipt. Receipts are private, so this asks the server for a link that works for
 * 5 minutes only, every time it opens.
 */
export default function ReceiptPreview({ paymentId, tall = false }: { paymentId: string; tall?: boolean }) {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['receipt-link', paymentId],
    queryFn: () => fetchReceiptLink(paymentId),
    staleTime: 0,
    gcTime: 0, // never keep an old link around
    retry: false,
    meta: { silent: true },
  });
  const height = tall ? 'h-[70vh] max-h-[70vh]' : 'h-[55vh] max-h-[55vh]';

  if (isPending) {
    return (
      <div className={`flex ${height} items-center justify-center rounded-xl bg-black/30 text-zinc-500`} role="status">
        <LoaderCircle className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
        Opening the receipt…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div role="alert" className={`flex ${height} flex-col items-center justify-center gap-4 rounded-xl bg-black/30 px-4 text-center`}>
        <p className="max-w-sm text-sm text-zinc-400">{toApiError(error).message}</p>
        <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />} onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.kind === 'pdf' ? (
        <iframe src={data.url} title="Receipt" className={`${height} w-full rounded-xl bg-white`} />
      ) : (
        <img src={data.url} alt="Receipt" className={`${height} w-full rounded-xl bg-black/40 object-contain`} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
        <span>This link works for {Math.round(data.expiresInSeconds / 60)} minutes.</span>
        <a href={data.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-gold-300 hover:text-gold-200">
          Open in a new tab <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
