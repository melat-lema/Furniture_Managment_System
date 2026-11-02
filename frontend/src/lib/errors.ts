import axios from 'axios';

export interface FieldError {
  field: string;
  message: string;
}

interface ApiErrorInit {
  status: number;
  code: string;
  message: string;
  fieldErrors?: FieldError[];
  requestId?: string;
}

/**
 * The one error type the whole frontend uses. Whatever goes wrong (server error, validation,
 * no internet, timeout) it becomes an ApiError with a stable `code` you can switch on.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: FieldError[];
  readonly requestId: string | undefined;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.fieldErrors = init.fieldErrors ?? [];
    this.requestId = init.requestId;
  }

  /** No internet, server down, or the request timed out. */
  get isNetwork(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT';
  }

  get isServer(): boolean {
    return this.status >= 500;
  }
}

function defaultMessage(status: number): string {
  if (status === 502 || status === 503 || status === 504) {
    return 'The server is unavailable right now. Please try again in a moment.';
  }
  if (status >= 500) return 'Something went wrong on our side. Please try again.';
  if (status === 401) return 'Please sign in to continue.';
  if (status === 403) return "You don't have permission to do this.";
  if (status === 404) return 'We could not find what you asked for.';
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  return 'The request could not be completed.';
}

interface ErrorBody {
  code?: string;
  message?: string;
  errors?: FieldError[];
  requestId?: string;
}

/** Turns anything thrown into an ApiError. Safe to call on any caught value. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError({
        status: 0,
        code: 'TIMEOUT',
        message: 'The server took too long to respond. Please try again.',
      });
    }

    if (!error.response) {
      return new ApiError({
        status: 0,
        code: 'NETWORK_ERROR',
        message: "We can't reach the server. Check your internet connection and try again.",
      });
    }

    const { status, data, headers } = error.response;
    const body: ErrorBody = typeof data === 'object' && data !== null ? (data as ErrorBody) : {};
    const headerId: unknown = headers['x-request-id'];

    // A 5xx with no JSON body did not come from our API (for example the dev proxy while the backend is off).
    const notFromApi = body.code === undefined && status >= 500;

    return new ApiError({
      status,
      code: notFromApi ? 'SERVER_UNAVAILABLE' : (body.code ?? `HTTP_${status}`),
      message: notFromApi
        ? 'The server is unavailable right now. Please try again in a moment.'
        : (body.message ?? defaultMessage(status)),
      fieldErrors: Array.isArray(body.errors) ? body.errors : [],
      requestId: body.requestId ?? (typeof headerId === 'string' ? headerId : undefined),
    });
  }

  if (error instanceof Error) {
    return new ApiError({ status: 0, code: 'CLIENT_ERROR', message: error.message });
  }
  return new ApiError({ status: 0, code: 'UNKNOWN', message: 'Something unexpected happened.' });
}
