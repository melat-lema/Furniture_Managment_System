import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CircleCheck, Hammer, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import FormAlert from '../components/FormAlert';
import ProductPicker from '../components/ProductPicker';
import { TextAreaField, TextField } from '../components/form/Fields';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import { useAuth } from '../features/auth/useAuth';
import { useRecordProduction } from '../features/stock/useStock';
import { handleFormError, type FormFailure } from '../lib/form-errors';
import type { ProductionResult } from '../types/api';

const optionSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
  imageUrl: z.string().nullable(),
});

const schema = z.object({
  note: z.string().trim().max(300, 'The note is too long (300 characters at most).'),
  items: z
    .array(
      z
        .object({
          product: optionSchema.nullable(),
          quantity: z.string().trim().regex(/^[1-9]\d{0,5}$/, 'Enter a whole number of 1 or more.'),
        })
        .refine((item) => item.product !== null, {
          message: 'Choose a product.',
          path: ['product'],
        }),
    )
    .min(1, 'Add at least one product.'),
});
type Values = z.infer<typeof schema>;

export default function RecordProductionPage() {
  const { user } = useAuth();
  const record = useRecordProduction();

  const [failure, setFailure] = useState<FormFailure | null>(null);
  const [done, setDone] = useState<ProductionResult | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { note: '', items: [{ product: null, quantity: '' }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    const items = values.items.flatMap((line) =>
      line.product ? [{ productId: line.product.id, quantity: Number(line.quantity) }] : [],
    );

    try {
      const result = await record.mutateAsync({ items, note: values.note || null });
      const total = result.lines.reduce((sum, line) => sum + line.added, 0);
      toast.success('Production recorded', {
        description: `${result.lines.length} product${result.lines.length === 1 ? '' : 's'}, ${total} item${total === 1 ? '' : 's'} added to stock.`,
      });
      setDone(result);
      reset({ note: '', items: [{ product: null, quantity: '' }] });
    } catch (error) {
      setFailure(handleFormError(error, setError, ['note', 'items']));
    }
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8 animate-fade-up">
      <PageHeader
        title="Record production"
        description={`Add newly finished furniture to the stock of ${user?.locationName ?? 'your workshop'}. You can add several products at once.`}
      />

      {done && (
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5" aria-live="polite">
          <div className="flex items-center gap-2 text-emerald-300">
            <CircleCheck className="h-5 w-5" aria-hidden="true" />
            <h2 className="font-semibold">Recorded successfully</h2>
          </div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {done.lines.map((line) => (
              <li key={line.productId} className="flex justify-between gap-4 text-zinc-300">
                <span className="truncate">{line.name}</span>
                <span className="shrink-0 text-zinc-400">
                  <span className="font-semibold text-emerald-300">+{line.added}</span> → now {line.newQuantity} at the workshop
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-3">
            <Link to="/stock" className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-300 hover:text-gold-200">
              View stock <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <button type="button" onClick={() => setDone(null)} className="text-sm text-zinc-500 hover:text-zinc-300">
              Dismiss
            </button>
          </div>
        </section>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-6 rounded-2xl border border-white/10 bg-ink-900 p-6 sm:p-8">
        {failure && <FormAlert title={failure.title} message={failure.message} tone={failure.tone} />}

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Hammer className="h-4 w-4 text-gold-400" aria-hidden="true" />
            What was finished?
          </div>

          {fields.map((field, index) => (
            <div key={field.id} className="grid gap-3 rounded-xl border border-white/5 bg-black/20 p-4 sm:grid-cols-[1fr_8rem_auto] sm:items-start">
              <Controller
                control={control}
                name={`items.${index}.product`}
                render={({ field: productField }) => (
                  <ProductPicker
                    label={index === 0 ? 'Product' : undefined}
                    value={productField.value}
                    onChange={productField.onChange}
                    error={errors.items?.[index]?.product?.message}
                  />
                )}
              />
              <TextField
                label={index === 0 ? 'How many?' : ''}
                inputMode="numeric"
                placeholder="10"
                aria-label="Quantity"
                error={errors.items?.[index]?.quantity?.message}
                {...register(`items.${index}.quantity`)}
              />
              <div className={index === 0 ? 'sm:pt-7' : ''}>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                  icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                  aria-label="Remove this line"
                >
                  <span className="sm:sr-only">Remove</span>
                </Button>
              </div>
            </div>
          ))}

          {errors.items?.message && <p role="alert" className="text-sm text-red-400">{errors.items.message}</p>}

          <Button
            variant="secondary"
            size="sm"
            icon={<Plus className="h-4 w-4" aria-hidden="true" />}
            onClick={() => append({ product: null, quantity: '' })}
            disabled={fields.length >= 50}
          >
            Add another product
          </Button>
        </div>

        <TextAreaField
          label="Note (optional)"
          rows={2}
          placeholder="For example: morning batch, order for Bole showroom"
          error={errors.note?.message}
          {...register('note')}
        />

        <div className="flex justify-end">
          <Button type="submit" loading={record.isPending}>
            Record production
          </Button>
        </div>
      </form>
    </div>
  );
}
