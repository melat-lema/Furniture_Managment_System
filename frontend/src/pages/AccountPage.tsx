import { zodResolver } from '@hookform/resolvers/zod';
import { Check, KeyRound, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import FormAlert from '../components/FormAlert';
import { TextField } from '../components/form/Fields';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import { useAuth } from '../features/auth/useAuth';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { handleFormError, type FormFailure } from '../lib/form-errors';
import { ROLE_LABELS } from '../types/auth';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z
      .string()
      .min(10, 'Use at least 10 characters.')
      .max(128, 'That password is too long.')
      .regex(/[A-Za-z]/, 'Include at least one letter.')
      .regex(/\d/, 'Include at least one number.'),
    confirmPassword: z.string().min(1, 'Repeat the new password.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'The two passwords do not match.',
    path: ['confirmPassword'],
  });
type Values = z.infer<typeof schema>;
const FIELDS = ['currentPassword', 'newPassword', 'confirmPassword'] as const;

export default function AccountPage() {
  const { user } = useAuth();
  const [failure, setFailure] = useState<FormFailure | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const newPassword = watch('newPassword');
  const rules = [
    { label: 'At least 10 characters', ok: newPassword.length >= 10 },
    { label: 'Contains a letter', ok: /[A-Za-z]/.test(newPassword) },
    { label: 'Contains a number', ok: /\d/.test(newPassword) },
  ];

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await api.post('/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      reset();
      toast.success('Password changed', { description: 'Your other devices were signed out.' });
    } catch (error) {
      setFailure(handleFormError(error, setError, FIELDS));
    }
  });

  if (!user) return null;
  const type = showPasswords ? 'text' : 'password';

  return (
    <div className="mx-auto max-w-2xl space-y-8 animate-fade-up">
      <PageHeader title="My account" description="Your details and your password." />

      <section className="flex items-center gap-4 rounded-2xl border border-white/10 bg-ink-900 p-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gold-500/15 font-display text-2xl font-semibold text-gold-300 ring-1 ring-gold-500/30">
          {user.fullName.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-zinc-100">{user.fullName}</p>
          <p className="truncate text-sm text-zinc-500">{user.email}</p>
          <p className="mt-0.5 text-sm text-gold-400/90">
            {ROLE_LABELS[user.role]}
            {user.locationName ? ` · ${user.locationName}` : ''}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-ink-900 p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/10 text-gold-400 ring-1 ring-gold-500/25">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Change password</h2>
            <p className="text-sm text-zinc-500">You will stay signed in here. Other devices are signed out.</p>
          </div>
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {failure && <FormAlert title={failure.title} message={failure.message} tone={failure.tone} />}

          <TextField
            label="Current password"
            type={type}
            autoComplete="current-password"
            required
            error={errors.currentPassword?.message}
            {...register('currentPassword')}
          />
          <TextField
            label="New password"
            type={type}
            autoComplete="new-password"
            required
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />

          <ul className="grid gap-1.5 text-sm sm:grid-cols-3" aria-label="Password rules">
            {rules.map((rule) => (
              <li key={rule.label} className={cn('flex items-center gap-2', rule.ok ? 'text-emerald-400' : 'text-zinc-500')}>
                <Check className={cn('h-4 w-4', rule.ok ? 'opacity-100' : 'opacity-30')} aria-hidden="true" />
                {rule.label}
              </li>
            ))}
          </ul>

          <TextField
            label="Repeat the new password"
            type={type}
            autoComplete="new-password"
            required
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={showPasswords}
              onChange={(event) => setShowPasswords(event.target.checked)}
              className="h-4 w-4 accent-gold-500"
            />
            Show passwords
          </label>

          <div className="flex items-center justify-between gap-4 pt-2">
            <p className="flex items-center gap-2 text-xs text-zinc-500">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Never share your password with anyone.
            </p>
            <Button type="submit" loading={isSubmitting}>
              Update password
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
