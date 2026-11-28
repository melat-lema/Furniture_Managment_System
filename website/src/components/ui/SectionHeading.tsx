import type { ReactNode } from 'react';
import Crown from './Crown';
import Reveal from './Reveal';

interface SectionHeadingProps {
  eyebrow: string;
  title: ReactNode;
  text?: string;
  align?: 'left' | 'center';
}

export default function SectionHeading({ eyebrow, title, text, align = 'left' }: SectionHeadingProps) {
  const center = align === 'center';
  return (
    <div className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <Reveal>
        <p className={`flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.28em] text-gold-400 ${center ? 'justify-center' : ''}`}>
          <Crown className="h-3.5 w-3.5" />
          {eyebrow}
        </p>
      </Reveal>
      <Reveal delay={0.08}>
        <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.05] text-white sm:text-5xl lg:text-6xl">{title}</h2>
      </Reveal>
      {text && (
        <Reveal delay={0.16}>
          <p className="mt-5 text-base leading-relaxed text-zinc-400 sm:text-lg">{text}</p>
        </Reveal>
      )}
    </div>
  );
}
