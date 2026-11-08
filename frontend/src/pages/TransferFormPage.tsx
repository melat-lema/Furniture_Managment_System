import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, PackageOpen, Plus, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import FormAlert from '../components/FormAlert';
import ProductPicker from '../components/ProductPicker';
import { SelectField, TextAreaField, TextField } from '../components/form/Fields';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import QueryError from '../components/ui/QueryError';
import { useAuth } from '../features/auth/useAuth';
import { useLocations } from '../features/locations/useLocations';
import { useSaveTransfer, useSendTransfer, useTransfer } from '../features/transfers/useTransfers';
import { handleFormError, type FormFailure } from '../lib/form-errors';
import { toApiError } from '../lib/errors';
import type { TransferDetail } from '../types/api';
import type { LocationType } from '../types/auth';

const ROUTES: Record<'WORKSHOP_MANAGER' | 'STORE_MANAGER', { from: LocationType; to: LocationType[] }> = {
  WORKSHOP_MANAGER: { from: 'WORKSHOP', to: ['STORE', 'SHOWROOM'] },
  STORE_MANAGER: { from: 'STORE', to: ['SHOWROOM'] },
};

const optionSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
  imageUrl: z.string().nullable(),
  available: z.number().optional(),
});

const schema = z.object({
  toLocationId: z.string().min(1, 'Choose where to send the goods.'),
  note: z.string().trim().max(300, 'The note is too long (300 characters at most).'),
  items: z
    .array(
      z
        .object({
          product: optionSchema.nullable().refine((product) => product !== null, 'Choose a product.'),
          quantity: z.string().trim().regex(/^[1-9]\d{0,5}$/, 'Enter a whole number of 1 or more.'),
        })
        .refine(
          (line) =>
            !line.product ||
            line.product.available === undefined ||
            !/^\d+$/.test(line.quantity) ||
            Number(line.quantity) <= line.product.available,
          { message: 'You do not have that many in stock.', path: ['quantity'] },
        ),
    )
    .min(1, 'Add at least one product.')
    .refine(
      (items) => {
        const ids = items.flatMap((line) => (line.product ? [line.product.id] : []));
        return new Set(ids).size === ids.length;
      },
      'Each product can only appear once. Combine the quantities into one line.',
    ),
});
type Values = z.input<typeof schema>;

export default function TransferFormPage() {
  const { id } = useParams();
  const { data: transfer, isPending, error, refetch } = useTransfer(id);

  if (id) {
    if (isPending) return <div className="h-64 animate-pulse rounded-2xl bg-white/5" aria-busy="true" />;
    if (error || !transfer) return <QueryError error={error} onRetry={() => void refetch()} />;
    if (!transfer.can.edit) {
      return (
        <EmptyState
          icon={PackageOpen}
          title="This transfer can no longer be edited"
          text="Only a draft can be changed. Once a transfer is sent, cancel it and create a new one if something is wrong."
          action={
            <Link to={`/transfers/${transfer.id}`}>
              <Button variant="secondary">Back to the transfer</Button>
            </Link>
          }
        />
      );
    }
  }
  return <TransferForm transfer={id ? transfer : undefined} />;
}

function TransferForm({ transfer }: { transfer?: TransferDetail }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const save = useSaveTransfer();
  const send = useSendTransfer();
  const { data: locations = [] } = useLocations();
  const [failure, setFailure] = useState<FormFailure | null>(null);

  const route = user && (user.role === 'WORKSHOP_MANAGER' || user.role === 'STORE_MANAGER') ? ROUTES[user.role] : null;
  const destinations = route ? locations.filter((location) => route.to.includes(location.type)) : [];

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values, any, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      toLocationId: transfer?.toLocation.id ?? '',
      note: transfer?.note ?? '',
      items: transfer
        ? transfer.items.map((item) => ({
            product: { id: item.product.id, name: item.product.name, sku: item.product.sku, imageUrl: item.product.imageUrl },
            quantity: String(item.qtySent),
          }))
        : [{ product: null, quantity: '' }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  /** Saves the draft, and optionally sends it right away. */
  const submitWith = (sendNow: boolean) =>
    handleSubmit(async (values) => {
      setFailure(null);
      const items = values.items.flatMap((line) =>
        line.product ? [{ productId: line.product.id, quantity: Number(line.quantity) }] : [],
      );

      let saved: TransferDetail;
      try {
        saved = await save.mutateAsync({ id: transfer?.id, toLocationId: values.toLocationId, items, note: values.note || null });
      } catch (error) {
        setFailure(handleFormError(error, setError, ['toLocationId', 'items', 'note']));
        return;
      }

      if (!sendNow) {
        toast.success(transfer ? 'Draft updated' : 'Draft saved', { description: saved.code });
        navigate(`/transfers/${saved.id}`);
        return;
      }

      try {
        await send.mutateAsync(saved.id);
        toast.success('Transfer sent', { description: `${saved.code} is on its way to ${saved.toLocation.name}.` });
      } catch (error) {
        // the draft exists; only the sending failed, so say exactly that
        toast.warning('Saved as a draft, but not sent', { description: toApiError(error).message });
      }
      navigate(`/transfers/${saved.id}`);
    });

  const busy = save.isPending || send.isPending;

  if (!route || !user?.locationId) {
    return (
      <EmptyState icon={PackageOpen} title="You cannot create transfers" text="Only the workshop and the store send goods." />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 animate-fade-up">
      <div>
        <Link to={transfer ? `/transfers/${transfer.id}` : '/transfers'} className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-gold-300">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Link>
        <PageHeader
          title={transfer ? `Edit ${transfer.code}` : 'New transfer'}
          description={`Goods leave the stock of ${user.locationName ?? 'your location'} only when you press Send.`}
        />
      </div>

      <form onSubmit={submitWith(false)} noValidate className="space-y-6 rounded-2xl border border-white/10 bg-ink-900 p-6 sm:p-8">
        {failure && <FormAlert title={failure.title} message={failure.message} tone={failure.tone} />}

        <SelectField
          label="Send to"
          required
          error={errors.toLocationId?.message}
          hint={destinations.length === 0 ? 'There is nowhere to send to yet. Ask the owner to add a store or showroom.' : undefined}
          {...register('toLocationId')}
        >
          <option value="">Choose the destination</option>
          {destinations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name} ({location.type.toLowerCase()})
            </option>
          ))}
        </SelectField>

        <div className="space-y-4">
          <p className="text-sm font-semibold text-zinc-200">What are you sending?</p>

          {fields.map((field, index) => (
            <div key={field.id} className="grid gap-3 rounded-xl border border-white/5 bg-black/20 p-4 sm:grid-cols-[1fr_8rem_auto] sm:items-start">
              <Controller
                control={control}
                name={`items.${index}.product`}
                render={({ field: productField }) => (
                  <ProductPicker
                    label={index === 0 ? 'Product (only what you have in stock)' : undefined}
                    value={productField.value}
                    onChange={productField.onChange}
                    stockLocationId={user.locationId ?? undefined}
                    error={errors.items?.[index]?.product?.message}
                  />
                )}
              />
              <TextField
                label={index === 0 ? 'How many?' : ''}
                inputMode="numeric"
                placeholder="2"
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
          {errors.items?.root?.message && <p role="alert" className="text-sm text-red-400">{errors.items.root.message}</p>}

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
          placeholder="For example: for the weekend display at Bole"
          error={errors.note?.message}
          {...register('note')}
        />

        <div className="flex flex-col-reverse gap-3 border-t border-white/5 pt-6 sm:flex-row sm:justify-end">
          <Button type="submit" variant="secondary" disabled={busy}>
            Save as draft
          </Button>
          <Button
            icon={<Send className="h-4 w-4" aria-hidden="true" />}
            loading={busy}
            onClick={() => void submitWith(true)()}
          >
            Send now
          </Button>
        </div>
      </form>
    </div>
  );
}
