import axios, { type InternalAxiosRequestConfig } from 'axios';
import { ApiError, toApiError } from './errors';

/** All requests go to /api (Vite forwards it to the NestJS backend in development). */
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // send the httpOnly login cookies
  timeout: 20_000,
});

// ---------------------------------------------------------------- session ended
type SessionEndedHandler = (message: string) => void;
let sessionEndedHandler: SessionEndedHandler | null = null;

/** AuthProvider registers this so the interceptor can sign the user out of the UI. */
export function setSessionEndedHandler(handler: SessionEndedHandler | null): void {
  sessionEndedHandler = handler;
}

// ---------------------------------------------------------------- silent refresh
/** The access cookie is missing or expired: try to get a new one with the refresh cookie. */
const REFRESHABLE_CODES = new Set(['UNAUTHENTICATED', 'TOKEN_EXPIRED']);
/** The session is really over: sign out. */
const SESSION_ENDED_CODES = new Set([
  'SESSION_REVOKED',
  'SESSION_EXPIRED',
  'TOKEN_INVALID',
  'ACCOUNT_DISABLED',
  'LOCATION_DISABLED',
]);
const AUTH_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout'];

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

let refreshInFlight: Promise<void> | null = null;

/**
 * Only ONE refresh runs at a time, however many requests fail together (and, through the
 * Web Locks API, even across browser tabs). Refresh tokens rotate, so two refreshes at once
 * would make the second one fail.
 */
function refreshSession(): Promise<void> {
  if (!refreshInFlight) {
    const run = (): Promise<void> =>
      axios
        .post('/api/auth/refresh', null, { withCredentials: true, timeout: 20_000 })
        .then(() => undefined);

    const attempt =
      typeof navigator !== 'undefined' && 'locks' in navigator
        ? (navigator.locks.request('gf-auth-refresh', run) as Promise<void>)
        : run();

    refreshInFlight = attempt.finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// ---------------------------------------------------------------- response handling
api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const apiError = toApiError(error);
    const config = (axios.isAxiosError(error) ? error.config : undefined) as RetriableConfig | undefined;
    const isAuthCall = AUTH_PATHS.some((path) => (config?.url ?? '').startsWith(path));

    // 1. Expired access cookie: refresh once, then repeat the original request.
    if (
      config &&
      !isAuthCall &&
      !config._retried &&
      apiError.status === 401 &&
      REFRESHABLE_CODES.has(apiError.code)
    ) {
      config._retried = true;
      try {
        await refreshSession();
      } catch (refreshError) {
        const failure = toApiError(refreshError);
        if (failure.isNetwork || failure.isServer) {
          // We could not reach the server: that does not mean the session ended.
          return Promise.reject(failure);
        }
        const message = 'Your session has expired. Please sign in again.';
        sessionEndedHandler?.(message);
        return Promise.reject(new ApiError({ status: 401, code: 'SESSION_EXPIRED', message }));
      }
      return api(config);
    }

    // 2. The server says the session is over (signed out elsewhere, account disabled...).
    if (!isAuthCall && SESSION_ENDED_CODES.has(apiError.code)) {
      sessionEndedHandler?.(apiError.message);
    }

    // 3. Everything else is passed on as a clean ApiError.
    return Promise.reject(apiError);
  },
);
