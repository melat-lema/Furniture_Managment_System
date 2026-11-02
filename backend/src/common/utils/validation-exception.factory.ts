import { BadRequestException, type ValidationError } from '@nestjs/common';
import { ErrorCode } from '../constants';

export interface FieldError {
  field: string;
  message: string;
}

function flatten(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own: FieldError[] = error.constraints
      ? [{ field, message: Object.values(error.constraints)[0] ?? 'Invalid value.' }]
      : [];
    const children = error.children && error.children.length > 0 ? flatten(error.children, field) : [];
    return [...own, ...children];
  });
}

/** Turns class-validator failures into { code, message, errors: [{ field, message }] }. */
export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    code: ErrorCode.VALIDATION_ERROR,
    message: 'Please check the highlighted fields and try again.',
    errors: flatten(errors),
  });
}
