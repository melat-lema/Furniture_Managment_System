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

  const byKey = Object.fromEntries(settings.map((setting) => [setting.key, setting])) as Record<SettingRecord['key'], SettingRecord>;
  const low = byKey.low_stock_threshold;
  const discount = byKey.max_discount_percent;

  const schema = z.object({
    low_stock_threshold: z
      .string()
      .trim()
      .regex(WHOLE, 'Enter a whole number.')
      .refine((value) => Number(value) >= low.min && Number(value) <= low.max, `Enter a number from ${low.min} to ${low.max}.`),
    max_discount_percent: z
      .string()
      .trim()
      .regex(WHOLE, 'Enter a whole number.')
      .refine((value) => Number(value) >= discount.min && Number(value) <= discount.max, `Enter a number from ${discount.min} to ${discount.max}.`),
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
    defaultValues: { low_stock_threshold: String(low.value), max_discount_percent: String(discount.value) },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await save.mutateAsync({
        low_stock_threshold: Number(values.low_stock_threshold),
        max_discount_percent: Number(values.max_discount_percent),
      });
      reset(values);
      toast.success('Settings saved');
    } catch (error) {
      setFailure(handleFormError(error, setError, ['low_stock_threshold', 'max_discount_percent']));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6 rounded-2xl border border-white/10 bg-ink-900 p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/10 text-gold-400 ring-1 ring-gold-500/25">
          <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-semibold text-zinc-100">Business rules</h2>
      </div>

      {failure && <FormAlert title={failure.title} message={failure.message} tone={failure.tone} />}

      <TextField
        label={`${low.label} (${low.unit})`}
        inputMode="numeric"
        hint={low.description}
        error={errors.low_stock_threshold?.message}
        {...register('low_stock_threshold')}
      />
      <TextField
        label={`${discount.label} (${discount.unit})`}
        inputMode="numeric"
        hint={discount.description}
        error={errors.max_discount_percent?.message}
        {...register('max_discount_percent')}
      />

      <div className="flex justify-end">
        <Button type="submit" loading={save.isPending} disabled={!isDirty}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
