import { CircleAlert } from 'lucide-react';
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../../lib/cn';

interface ShellProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

function Shell({ id, label, hint, error, required, children }: ShellProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-zinc-300">
        {label}
        {required && <span className="ml-0.5 text-gold-400" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-zinc-500">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm text-red-400">
          <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

const CONTROL =
  'w-full rounded-xl border bg-black/40 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50';
const OK = 'border-white/10 focus:border-gold-500/70 focus:ring-gold-500/15';
const BAD = 'border-red-500/60 focus:border-red-500 focus:ring-red-500/15';

interface CommonProps {
  label: string;
  hint?: string;
  error?: string;
}

export const TextField = forwardRef<HTMLInputElement, CommonProps & InputHTMLAttributes<HTMLInputElement>>(
  function TextField({ label, hint, error, required, className, ...rest }, ref) {
    const id = useId();
    return (
      <Shell id={id} label={label} hint={hint} error={error} required={required}>
        <input
          id={id}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(CONTROL, error ? BAD : OK, className)}
          {...rest}
        />
      </Shell>
    );
  },
);

export const SelectField = forwardRef<HTMLSelectElement, CommonProps & SelectHTMLAttributes<HTMLSelectElement>>(
  function SelectField({ label, hint, error, required, className, children, ...rest }, ref) {
    const id = useId();
    return (
      <Shell id={id} label={label} hint={hint} error={error} required={required}>
        <select
          id={id}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(CONTROL, '[&>option]:bg-ink-900', error ? BAD : OK, className)}
          {...rest}
        >
          {children}
        </select>
      </Shell>
    );
  },
);

export const TextAreaField = forwardRef<HTMLTextAreaElement, CommonProps & TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextAreaField({ label, hint, error, required, className, ...rest }, ref) {
    const id = useId();
    return (
      <Shell id={id} label={label} hint={hint} error={error} required={required}>
        <textarea
          id={id}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(CONTROL, 'min-h-24 resize-y', error ? BAD : OK, className)}
          {...rest}
        />
      </Shell>
    );
  },
);

interface ToggleProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

/** An on/off switch. Works with react-hook-form's register(). */
export const ToggleField = forwardRef<HTMLInputElement, ToggleProps>(function ToggleField(
  { label, hint, className, ...rest },
  ref,
) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-white/10 bg-black/30 p-4', className)}>
      <span>
        <span className="block text-sm font-medium text-zinc-200">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-zinc-500">{hint}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input id={id} ref={ref} type="checkbox" role="switch" className="peer sr-only" {...rest} />
        <span className="h-6 w-11 rounded-full bg-zinc-700 transition peer-checked:bg-gold-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-300" />
        <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
});
