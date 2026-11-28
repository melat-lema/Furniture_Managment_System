export function formatPrice(value: number | null): string | null {
  if (value === null) return null;
  return `ETB ${Math.round(value).toLocaleString('en-US')}`;
}

export const telHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`;

export const mapsHref = (query: string): string => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
