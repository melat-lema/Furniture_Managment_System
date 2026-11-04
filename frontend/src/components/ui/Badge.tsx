import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'gold' | 'green' | 'red' | 'zinc' | 'blue' | 'amber';

const TONES: Record<Tone, string> = {
  gold: 'bg-gold-500/10 text-gold-300 ring-gold-500/30',
  green: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
  red: 'bg-red-500/10 text-red-300 ring-red-500/30',
  zinc: 'bg-white/5 text-zinc-400 ring-white/10',
  blue: 'bg-sky-500/10 text-sky-300 ring-sky-500/30',
  amber: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
};

export default function Badge({ tone = 'zinc', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1',
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
