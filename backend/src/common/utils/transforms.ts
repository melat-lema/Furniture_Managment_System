/** Query strings arrive as text: "true" / "false" become real booleans, anything else is ignored. */
export function toBoolean({ value }: { value: unknown }): boolean | undefined {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

/** Trims text; empty text becomes undefined. */
export function trimToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Trims text; empty text becomes null (used to clear an optional field). */
export function trimToNull({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Trims text and keeps it (required fields). */
export function trim({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
