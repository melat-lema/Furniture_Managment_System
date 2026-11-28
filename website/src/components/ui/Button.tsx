import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'gold' | 'ghost';

interface Common {
  variant?: Variant;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}

const BASE =
  'group relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-full px-7 py-3.5 text-sm font-semibold tracking-wide transition duration-300 focus-visible:outline-offset-4';
const VARIANTS: Record<Variant, string> = {
  gold: 'bg-linear-to-r from-gold-300 via-gold-400 to-gold-500 text-ink-950 shadow-[0_8px_30px_-8px_rgb(226_176_74/0.55)] hover:shadow-[0_10px_40px_-6px_rgb(226_176_74/0.75)] hover:-translate-y-0.5',
  ghost: 'border border-white/15 text-zinc-100 hover:border-gold-400/60 hover:bg-white/5 hover:-translate-y-0.5',
};

/** The little light that sweeps across the button when you hover it. */
function Shine() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -translate-x-full skew-x-[-20deg] bg-white/40 opacity-0 group-hover:animate-shine group-hover:opacity-100"
    />
  );
}

export function LinkButton({ variant = 'gold', children, className = '', icon, ...rest }: Common & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={`${BASE} ${VARIANTS[variant]} ${className}`} {...rest}>
      {variant === 'gold' && <Shine />}
      <span className="relative">{children}</span>
      {icon && <span className="relative">{icon}</span>}
    </a>
  );
}

export function Button({ variant = 'gold', children, className = '', icon, type = 'button', ...rest }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={`${BASE} ${VARIANTS[variant]} disabled:pointer-events-none disabled:opacity-50 ${className}`} {...rest}>
      {variant === 'gold' && <Shine />}
      <span className="relative">{children}</span>
      {icon && <span className="relative">{icon}</span>}
    </button>
  );
}
