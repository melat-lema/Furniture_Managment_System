import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form';
import { toApiError } from './errors';
import { notifyError } from './notify';

export interface FormFailure {
  title: string;
  message: string;
  tone: 'error' | 'warning';
}

/**
 * The standard reaction to a failed form submit:
 *  1. problems the server tied to a field appear under that field,
 *  2. anything else comes back as a message for a <FormAlert> above the form,
 *  3. connection and server problems also get a toast (typing again will not fix them).
 * Returns null when the field messages already say everything.
 */
export function handleFormError<T extends FieldValues>(
  caught: unknown,
  setError: UseFormSetError<T>,
  fields: ReadonlyArray<FieldPath<T>>,
): FormFailure | null {
  const error = toApiError(caught);

  let matched = false;
  for (const fieldError of error.fieldErrors) {
    const field = fields.find((name) => name === fieldError.field);
    if (field) {
      setError(field, { type: 'server', message: fieldError.message });
      matched = true;
    }
  }

  const trouble = error.isNetwork || error.isServer;
  if (trouble) notifyError(error, 'Could not save');
  if (matched && !trouble) return null;

  const reference = error.isServer && error.requestId ? ` (Ref: ${error.requestId.slice(0, 8)})` : '';
  return {
    title: titleFor(error.status, error.isNetwork),
    message: `${error.message}${reference}`,
    tone: error.status === 409 || error.status === 429 || error.status === 403 ? 'warning' : 'error',
  };
}

function titleFor(status: number, isNetwork: boolean): string {
  if (isNetwork) return 'Cannot reach the server';
  if (status >= 500) return 'Server problem';
  if (status === 403) return 'Not allowed';
  if (status === 404) return 'Not found';
  if (status === 409) return 'This conflicts with existing data';
  if (status === 429) return 'Please slow down';
  return 'Please check the form';
}
