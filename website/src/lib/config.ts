const read = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

/** Things the client can set in the website's .env file. Empty means "do not show". */
export const site = {
  name: 'Gorgeous Furniture',
  city: 'Addis Ababa',
  phone: read(import.meta.env.VITE_PHONE),
  whatsapp: read(import.meta.env.VITE_WHATSAPP)?.replace(/\D/g, '') ?? null,
  email: read(import.meta.env.VITE_EMAIL),
  hours: read(import.meta.env.VITE_HOURS),
  social: {
    instagram: read(import.meta.env.VITE_INSTAGRAM),
    facebook: read(import.meta.env.VITE_FACEBOOK),
    telegram: read(import.meta.env.VITE_TELEGRAM),
    tiktok: read(import.meta.env.VITE_TIKTOK),
  },
};
