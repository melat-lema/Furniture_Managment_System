import Crown from '../components/ui/Crown';
import { useSite } from '../hooks/useSite';

/** A slow, endless band of the kinds of furniture we make. */
export default function Marquee() {
  const { data } = useSite();
  const words = data.categories.length > 0 ? data.categories.map((category) => category.name) : ['Sofas', 'Beds', 'Dining', 'Chairs', 'Wardrobes', 'Office'];
  const row = [...words, ...words, ...words];

  return (
    <div className="relative overflow-hidden border-y border-white/5 bg-ink-900 py-6" aria-hidden="true">
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-center">
            {row.map((word, index) => (
              <span key={`${word}-${index}`} className="flex items-center">
                <span className="px-8 font-display text-3xl font-semibold uppercase tracking-[0.12em] text-zinc-600 transition-colors hover:text-gold-300 sm:text-4xl">{word}</span>
                <Crown className="h-4 w-4 text-gold-500/70" />
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-linear-to-r from-ink-900 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-linear-to-l from-ink-900 to-transparent" />
    </div>
  );
}
