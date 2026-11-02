/**
 * A harmless flag (not a token!) that remembers "this browser had a session".
 * It lets the app skip a pointless network call on first visit. The real login lives in
 * httpOnly cookies that JavaScript cannot read.
 */
const KEY = 'gf_session_hint';

export function hasSessionHint(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setSessionHint(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* storage unavailable: the app still works, it just checks the server on every visit */
  }
}

export function clearSessionHint(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
