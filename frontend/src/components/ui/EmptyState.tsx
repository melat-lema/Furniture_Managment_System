import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  text?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon: Icon, title, text, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500/10 text-gold-400 ring-1 ring-gold-500/25">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="mt-5 text-lg font-semibold text-zinc-100">{title}</h2>
      {text && <p className="mt-1 max-w-sm text-sm text-zinc-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
