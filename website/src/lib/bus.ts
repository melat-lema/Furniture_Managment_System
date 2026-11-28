import type { ProductCard } from './types';

/** Tiny messages between far-apart parts of the page (the product dialog and the chatbot). */
export const openProduct = (product: ProductCard): void => {
  window.dispatchEvent(new CustomEvent<ProductCard>('gf:product', { detail: product }));
};

export const openChat = (message?: string): void => {
  window.dispatchEvent(new CustomEvent<{ message?: string }>('gf:chat', { detail: { message } }));
};
