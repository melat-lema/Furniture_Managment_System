import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSite } from '../hooks/useSite';
import { openChat } from '../lib/bus';
import { formatPrice } from '../lib/format';
import type { ProductCard } from '../lib/types';
import { LinkButton } from './ui/Button';
import Crown from './ui/Crown';

/** The pop-up with the details of one piece. It opens when any part of the page asks for a product. */
export default function ProductDialog() {
  const { whatsapp } = useSite();
  const [product, setProduct] = useState<ProductCard | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onOpen = (event: Event) => setProduct((event as CustomEvent<ProductCard>).detail);
    window.addEventListener('gf:product', onOpen);
    return () => window.removeEventListener('gf:product', onOpen);
  }, []);

  useEffect(() => {
    if (!product) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProduct(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [product]);

  const price = product ? formatPrice(product.price) : null;
  const facts = product
    ? [
        { label: 'Material', value: product.material },
        { label: 'Size', value: product.dimensions },
      ].filter((fact): fact is { label: string; value: string } => Boolean(fact.value))
    : [];

  return (
    <AnimatePresence>
      {product && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setProduct(null)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={product.name}
            initial={{ opacity: 0, y: 60, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.98 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            onClick={(event) => event.stopPropagation()}
            className="relative grid max-h-[92svh] w-full max-w-5xl overflow-y-auto rounded-t-[2rem] border border-white/10 bg-ink-900 shadow-2xl sm:rounded-[2rem] md:grid-cols-2"
          >
            <button
              ref={closeButton}
              type="button"
              onClick={() => setProduct(null)}
              aria-label="Close"
              className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/50 text-zinc-100 backdrop-blur transition hover:border-gold-400/60"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative aspect-square bg-ink-800 md:aspect-auto md:min-h-[32rem]">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(70%_60%_at_50%_40%,rgb(201_154_46/0.2),transparent),linear-gradient(160deg,#18181b,#0a0a0b)]">
                  <Crown className="h-20 w-20 text-gold-500/50" />
                </div>
              )}
            </div>

            <div className="flex flex-col p-7 sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-400">{product.category}</p>
              <h3 className="mt-3 font-display text-4xl font-semibold leading-tight text-white sm:text-5xl">{product.name}</h3>
              {price && <p className="mt-4 text-2xl font-semibold text-gold-300">{price}</p>}
              {product.description && <p className="mt-5 leading-relaxed text-zinc-400">{product.description}</p>}

              {facts.length > 0 && (
                <dl className="mt-6 divide-y divide-white/5 border-y border-white/5">
                  {facts.map((fact) => (
                    <div key={fact.label} className="flex justify-between gap-6 py-3 text-sm">
                      <dt className="text-zinc-500">{fact.label}</dt>
                      <dd className="text-right text-zinc-200">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <div className="mt-auto flex flex-col gap-3 pt-8 sm:flex-row">
                <LinkButton
                  href="#showrooms"
                  onClick={() => setProduct(null)}
                  className="flex-1"
                  icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
                >
                  See it in a showroom
                </LinkButton>
                {whatsapp ? (
                  <LinkButton
                    variant="ghost"
                    className="flex-1"
                    href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hello Gorgeous Furniture, I am interested in the ${product.name}.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    icon={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
                  >
                    Ask on WhatsApp
                  </LinkButton>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const name = product.name;
                      setProduct(null);
                      openChat(`Tell me about the ${name}`);
                    }}
                    className="flex flex-1 items-center justify-center gap-2.5 rounded-full border border-white/15 px-7 py-3.5 text-sm font-semibold text-zinc-100 transition hover:border-gold-400/60 hover:bg-white/5"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    Ask our assistant
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
