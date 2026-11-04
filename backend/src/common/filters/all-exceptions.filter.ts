import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client';
import { ErrorCode } from '../constants';
import type { FieldError } from '../utils/validation-exception.factory';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  errors?: FieldError[];
  /** Only filled outside production, to help you debug. Never sent in production. */
  detail?: string;
}

const STATUS_DEFAULTS: Record<number, { code: string; message: string }> = {
  400: { code: 'BAD_REQUEST', message: 'The request could not be understood.' },
  401: { code: ErrorCode.UNAUTHENTICATED, message: 'Please sign in to continue.' },
  403: { code: 'FORBIDDEN', message: "You don't have permission to do this." },
  404: { code: ErrorCode.NOT_FOUND, message: 'We could not find what you asked for.' },
  409: { code: ErrorCode.CONFLICT, message: 'This action conflicts with existing data.' },
  413: { code: ErrorCode.FILE_TOO_LARGE, message: 'That file is too big. The maximum size is 5 MB.' },
  415: { code: ErrorCode.INVALID_FILE, message: 'That type of file is not supported.' },
  429: { code: ErrorCode.RATE_LIMITED, message: 'Too many requests. Please wait a moment and try again.' },
};

const DB_UNREACHABLE_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017']);

/**
 * The single place where every error becomes a clean JSON response:
 * { statusCode, code, message, errors?, path, timestamp, requestId }
 * - Known problems get friendly, specific messages.
 * - Unknown problems become a generic 500 (the real error is only written to the server log).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = String(request.headers['x-request-id'] ?? '');

    const body = this.toBody(exception);

    const summary = `[${requestId}] ${request.method} ${request.originalUrl} -> ${body.statusCode} ${body.code}`;
    if (body.statusCode >= 500) {
      this.logger.error(summary, exception instanceof Error ? exception.stack : String(exception));
    } else {
      this.logger.warn(summary);
    }

    response.status(body.statusCode).json({
      ...body,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
      requestId,
    });
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) return this.fromHttp(exception);
    if (exception instanceof Prisma.PrismaClientKnownRequestError) return this.fromPrisma(exception);

    if (exception instanceof Error) {
      if (exception.name === 'PrismaClientInitializationError') return this.databaseUnavailable(exception.message);
      if (/violates check constraint/i.test(exception.message)) {
        return {
          statusCode: 400,
          code: ErrorCode.CHECK_VIOLATION,
          message: "That change isn't allowed by the business rules (for example, stock can't go below zero).",
          detail: this.devOnly(exception.message),
        };
      }
    }
    return this.internal(exception);
  }

  private fromHttp(exception: HttpException): ErrorBody {
    const status = exception.getStatus();
    const raw = exception.getResponse();
    const fallback = STATUS_DEFAULTS[status] ?? {
      code: `HTTP_${status}`,
      message: 'Something went wrong with this request.',
    };

    if (typeof raw === 'object' && raw !== null) {
      const body = raw as { code?: unknown; message?: unknown; errors?: unknown };

      // Our own errors: { code, message, errors? }
      if (typeof body.code === 'string' && typeof body.message === 'string') {
        return {
          statusCode: status,
          code: body.code,
          message: body.message,
          errors: Array.isArray(body.errors) ? (body.errors as FieldError[]) : undefined,
        };
      }

      // Built-in Nest errors (404 route not found, throttler, etc.)
      const original = Array.isArray(body.message)
        ? body.message.join('; ')
        : typeof body.message === 'string'
          ? body.message
          : undefined;
      return { statusCode: status, ...fallback, detail: this.devOnly(original) };
    }

    return { statusCode: status, ...fallback, detail: this.devOnly(typeof raw === 'string' ? raw : undefined) };
  }

  private fromPrisma(error: Prisma.PrismaClientKnownRequestError): ErrorBody {
    if (DB_UNREACHABLE_CODES.has(error.code)) return this.databaseUnavailable(error.message);

    switch (error.code) {
      case 'P2002': {
        const target = error.meta?.target;
        const fields = Array.isArray(target) ? target.map(String) : typeof target === 'string' ? [target] : [];
        const field = fields[0];
        const message = field ? `That ${field} is already in use.` : 'That value already exists.';
        return {
          statusCode: 409,
          code: ErrorCode.UNIQUE_CONSTRAINT,
          message,
          errors: field ? [{ field, message }] : undefined,
        };
      }
      case 'P2025':
        return {
          statusCode: 404,
          code: ErrorCode.NOT_FOUND,
          message: 'The record you are looking for no longer exists.',
        };
      case 'P2003':
        return {
          statusCode: 409,
          code: ErrorCode.REFERENCE_CONSTRAINT,
          message: 'This record is linked to other data, so that change is not allowed.',
        };
      case 'P2034':
        return {
          statusCode: 409,
          code: ErrorCode.CONFLICT,
          message: 'Another update happened at the same time. Please try again.',
        };
      default:
        return this.internal(error);
    }
  }

  private databaseUnavailable(detail: string): ErrorBody {
    return {
      statusCode: 503,
      code: ErrorCode.DATABASE_UNAVAILABLE,
      message: 'The system cannot reach its database right now. Please try again in a moment.',
      detail: this.devOnly(detail),
    };
  }

  private internal(exception: unknown): ErrorBody {
    return {
      statusCode: 500,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Something went wrong on our side. Please try again, and contact support with the reference code if it continues.',
      detail: this.devOnly(exception instanceof Error ? exception.message : String(exception)),
    };
  }

  private devOnly(value: string | undefined): string | undefined {
    return process.env.NODE_ENV === 'production' ? undefined : value;
  }
}
