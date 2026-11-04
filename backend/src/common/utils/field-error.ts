import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '../constants';

/** 400 with a message under one specific form field. */
export function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({
    code: ErrorCode.VALIDATION_ERROR,
    message,
    errors: [{ field, message }],
  });
}

/** 409 for "this value is already used", pointing at the field. */
export function duplicateError(field: string, message: string): ConflictException {
  return new ConflictException({
    code: ErrorCode.UNIQUE_CONSTRAINT,
    message,
    errors: [{ field, message }],
  });
}

/** 409 for a business rule that blocks the action (no specific field). */
export function ruleError(code: string, message: string): ConflictException {
  return new ConflictException({ code, message });
}

export function notFound(what: string): NotFoundException {
  return new NotFoundException({ code: ErrorCode.NOT_FOUND, message: `${what} was not found.` });
}
