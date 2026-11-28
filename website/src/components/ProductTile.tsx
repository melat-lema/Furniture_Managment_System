import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import type { PointerEvent } from 'react';
import { openProduct } from '../lib/bus';
import { formatPrice } from '../lib/format';
import type { ProductCard } from '../lib/types';
import Crown from './ui/Crown';

/** One piece in the grid. On a computer it leans toward the cursor; on a phone it simply opens. */
export default function ProductTile({ product, index = 0 }: { product: ProductCard; index?: number }) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [6, -6]), { stiffness: 220, damping: 22 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-6, 6]), { stiffness: 220, damping: 22 });
  const price = formatPrice(product.price);

  const onMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (reduce || event.pointerType !== 'mouse') return;
    const box = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - box.left) / box.width - 0.5);
    y.set((event.clientY - box.top) / box.height - 0.5);
  };
  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.7, delay: (index % 4) * 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.button
        type="button"
        onClick={() => openProduct(product)}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        style={{ rotateX, rotateY, transformPerspective: 900 }}
        className="group block w-full text-left"
        aria-label={`View ${product.name}`}
      >
        <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-white/10 bg-ink-800">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(70%_60%_at_50%_40%,rgb(201_154_46/0.18),transparent),linear-gradient(160deg,#18181b,#0a0a0b)]">
              <Crown className="h-14 w-14 text-gold-500/50 transition duration-500 group-hover:scale-110 group-hover:text-gold-400" />
            </div>
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent opacity-80" />
          <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-200 backdrop-blur">
            {product.category}
          </span>
          <span className="absolute bottom-4 right-4 translate-y-3 rounded-full bg-gold-400 px-4 py-2 text-xs font-bold text-ink-950 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            View
          </span>
        </div>
        <div className="mt-4 flex items-start justify-between gap-4 px-1">
          <h3 className="font-display text-2xl font-semibold leading-tight text-white transition-colors group-hover:text-gold-200">{product.name}</h3>
          {price && <p className="shrink-0 pt-1 text-sm font-semibold text-gold-300">{price}</p>}
        </div>
      </motion.button>
    </motion.li>
  );
}
