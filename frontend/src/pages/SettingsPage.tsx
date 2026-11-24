import { zodResolver } from '@hookform/resolvers/zod';
import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import FormAlert from '../components/FormAlert';
import { TextField } from '../components/form/Fields';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import QueryError from '../components/ui/QueryError';
import { useSaveSettings, useSettings } from '../features/settings/useSettings';
import { handleFormError, type FormFailure } from '../lib/form-errors';
import type { SettingRecord } from '../types/api';

const WHOLE = /^\d{1,4}$/;

const GROUPS: Array<{ title: string; keys: SettingRecord['key'][] }> = [
  { title: 'Stock', keys: ['low_stock_threshold'] },
  { title: 'Sales', keys: ['max_discount_percent', 'sale_void_window_hours'] },
  { title: 'Payments', keys: ['payment_reminder_hours', 'payment_escalation_hours'] },
];

export default function SettingsPage() {
  const { data, isPending, error, refetch } = useSettings();

  return (
    <div className="mx-auto max-w-2xl space-y-8 animate-fade-up">
      <PageHeader title="Settings" description="Numbers the system uses. Change them here, no developer needed." />
      {isPending ? (
        <div className="h-64 animate-pulse rounded-2xl bg-white/5" aria-busy="true" />
      ) : error || !data ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : (
        <SettingsForm settings={data} />
      )}
    </div>
  );
}

function SettingsForm({ settings }: { settings: SettingRecord[] }) {
  const save = useSaveSettings();
  const [failure, setFailure] = useState<FormFailure | null>(null);
  const byKey = new Map(settings.map((setting) => [setting.key, setting]));

  // one rule per setting, built from its allowed range
  const shape = Object.fromEntries(
    settings.map((setting) => [
      setting.key,
      z
        .string()
        .trim()
        .regex(WHOLE, 'Enter a whole number.')
        .refine((value) => Number(value) >= setting.min && Number(value) <= setting.max, `Enter a number from ${setting.min} to ${setting.max}.`),
    ]),
  );
  const schema = z.object(shape).refine((values) => Number(values.payment_escalation_hours) > Number(values.payment_reminder_hours), {
    message: 'This must be later than the reminder time.',
    path: ['payment_escalation_hours'],
  });
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(settings.map((setting) => [setting.key, String(setting.value)])),
  });

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await save.mutateAsync(Object.fromEntries(settings.map((setting) => [setting.key, Number(values[setting.key])])));
      reset(values);
      toast.success('Settings saved');
    } catch (error) {
      setFailure(handleFormError(error, setError, settings.map((setting) => setting.key)));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {failure && <FormAlert title={failure.title} message={failure.message} tone={failure.tone} />}

      {GROUPS.map((group) => (
        <section key={group.title} className="space-y-6 rounded-2xl border border-white/10 bg-ink-900 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/10 text-gold-400 ring-1 ring-gold-500/25">
              <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-semibold text-zinc-100">{group.title}</h2>
          </div>
          {group.keys.map((key) => {
            const setting = byKey.get(key);
            if (!setting) return null;
            return (
              <TextField
                key={key}
                label={`${setting.label} (${setting.unit})`}
                inputMode="numeric"
                hint={setting.description}
                error={errors[key]?.message}
                {...register(key)}
              />
            );
          })}
        </section>
      ))}

      <div className="flex justify-end">
        <Button type="submit" loading={save.isPending} disabled={!isDirty}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
