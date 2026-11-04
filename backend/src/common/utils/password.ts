import { randomBytes } from 'node:crypto';

/** 16 random characters (letters, digits, - and _). Shown to the owner once, never stored in plain text. */
export function generateTempPassword(): string {
  return randomBytes(12).toString('base64url');
}
