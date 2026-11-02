import { toast } from 'sonner';
import { toApiError } from './errors';

/**
 * Shows the right toast for any error. Use it in catch blocks and in React Query handlers.
 * Sign-in problems (401) are skipped on purpose: the auth layer shows its own "signed out" message.
 */
export function notifyError(error: unknown, fallbackTitle = 'Something went wrong'): void {
  const apiError = toApiError(error);
  const reference = apiError.requestId ? ` (Ref: ${apiError.requestId.slice(0, 8)})` : '';

  if (apiError.status === 401) return;

  if (apiError.isNetwork) {
    toast.error("Can't reach the server", { id: 'network-error', description: apiError.message });
    return;
  }
  if (apiError.status === 403) {
    toast.error("You don't have permission", { description: apiError.message });
    return;
  }
  if (apiError.status === 429) {
    toast.warning('Please slow down', { description: apiError.message });
    return;
  }
  if (apiError.isServer) {
    toast.error('Server problem', { description: `${apiError.message}${reference}` });
    return;
  }
  toast.error(fallbackTitle, { description: apiError.message });
}
