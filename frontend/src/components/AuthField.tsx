import { CircleAlert, type LucideIcon } from 'lucide-react';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon: LucideIcon;
  error?: string;
  rightSlot?: ReactNode;
}

/** A labelled input with a leading icon and an accessible error message underneath. */
const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField(
  { label, icon: Icon, error, rightSlot, ...inputProps },
  ref,
) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-zinc-300">
        {label}
      </label>
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border bg-black/40 px-4 transition focus-within:ring-4',
          error
            ? 'border-red-500/60 focus-within:border-red-500 focus-within:ring-red-500/15'
            : 'border-white/10 focus-within:border-gold-500/70 focus-within:ring-gold-500/15',
        )}
      >
        <Icon className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden="true" />
        <input
          id={id}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="w-full bg-transparent py-3.5 text-[15px] text-zinc-100 outline-none placeholder:text-zinc-600"
          {...inputProps}
        />
        {rightSlot}
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 flex items-center gap-1.5 text-sm text-red-400">
          <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
});

export default AuthField;
