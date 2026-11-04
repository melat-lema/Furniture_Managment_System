const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "12500" -> "ETB 12,500.00" */
export function formatMoney(value: string | number): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? `ETB ${money.format(amount)}` : '-';
}

export function formatDate(value: string | null): string {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

export function formatDateTime(value: string | null): string {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
