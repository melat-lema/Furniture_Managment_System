import { CircleAlert, TriangleAlert } from 'lucide-react';
import { cn } from '../lib/cn';

interface FormAlertProps {
  title: string;
  message: string;
  tone?: 'error' | 'warning';
  className?: string;
}

/** Inline message for problems that belong to the whole form, not to one field. */
export default function FormAlert({ title, message, tone = 'error', className }: FormAlertProps) {
  const Icon = tone === 'error' ? CircleAlert : TriangleAlert;
  return (
    <div
      role="alert"
      className={cn(
        'flex gap-3 rounded-xl border p-4 text-sm',
        tone === 'error'
          ? 'border-red-500/30 bg-red-500/10 text-red-200'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-200',
        className,
      )}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 opacity-90">{message}</p>
      </div>
    </div>
  );
}
