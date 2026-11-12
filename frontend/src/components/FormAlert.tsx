import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import { cn } from '../lib/cn';

interface FormAlertProps {
  title: string;
  message: string;
  tone?: 'error' | 'warning' | 'info';
  className?: string;
}

const STYLES = {
  error: 'border-red-500/30 bg-red-500/10 text-red-200',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
} as const;

const ICONS = { error: CircleAlert, warning: TriangleAlert, info: Info } as const;

/** Inline message for problems or explanations that belong to the whole form or page. */
export default function FormAlert({ title, message, tone = 'error', className }: FormAlertProps) {
  const Icon = ICONS[tone];
  return (
    <div role={tone === 'info' ? 'status' : 'alert'} className={cn('flex gap-3 rounded-xl border p-4 text-sm', STYLES[tone], className)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 opacity-90">{message}</p>
      </div>
    </div>
  );
}
