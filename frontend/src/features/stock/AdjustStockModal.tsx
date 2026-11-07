import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import FormAlert from '../../components/FormAlert';
import { SelectField, TextAreaField, TextField } from '../../components/form/Fields';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { handleFormError, type FormFailure } from '../../lib/form-errors';
import type { StockLevelRow } from '../../types/api';
import { useAdjustStock } from './useStock';

interface AdjustStockModalProps {
  open: boolean;
  onClose: () => void;
  row: StockLevelRow | null;
  /** Where the stock is (the owner picks it on the page; managers use their own) */
  locationId: string;
  locationName: string;
  /** The owner must send the location id; managers must not choose one */
  sendLocation: boolean;
}

export default function AdjustStockModal({ open, onClose, row, locationId, locationName, sendLocation }: AdjustStockModalProps) {
  return (
    <Modal
      open={open && row !== null}
      onClose={onClose}
      size="sm"
      title="Adjust stock"
      description={row ? `${row.product.name} at ${locationName}` : undefined}
    >
      {row && <AdjustForm row={row} locationId={locationId} sendLocation={sendLocation} onClose={onClose} />}
    </Modal>
  );
}

const FIELDS = ['direction', 'quantity', 'reason', 'note'] as const;

function AdjustForm({
  row,
  locationId,
  sendLocation,
  onClose,
}: {
  row: StockLevelRow;
  locationId: string;
  sendLocation: boolean;
  onClose: () => void;
}) {
  const adjust = useAdjustStock();
  const [failure, setFailure] = useState<FormFailure | null>(null);

  const schema = useMemo(
    () =>
      z
        .object({
          direction: z.enum(['add', 'remove']),
          quantity: z.string().trim().regex(/^[1-9]\d{0,5}$/, 'Enter a whole number of 1 or more.'),
          reason: z.enum(['DAMAGED', 'MISCOUNT', 'FOUND', 'OTHER']),
          note: z.string().trim().max(300, 'The note is too long (300 characters at most).'),
        })
        .refine((values) => values.direction === 'add' || Number(values.quantity) <= row.quantity, {
          message: `You only have ${row.quantity} in stock, so you cannot remove more.`,
          path: ['quantity'],
        })
        .refine((values) => values.reason !== 'OTHER' || values.note !== '', {
          message: 'Please explain what happened.',
          path: ['note'],
        }),
    [row.quantity],
  );
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { direction: 'remove', quantity: '', reason: 'DAMAGED', note: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    const amount = Number(values.quantity);
    try {
      const result = await adjust.mutateAsync({
        productId: row.product.id,
        quantity: values.direction === 'add' ? amount : -amount,
        reason: values.reason,
        note: values.note || null,
        ...(sendLocation && { locationId }),
      });
      toast.success('Stock updated', { description: `${row.product.name}: now ${result.newQuantity} in stock.` });
      onClose();
    } catch (error) {
      setFailure(handleFormError(error, setError, FIELDS));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-zinc-400">
        Currently in stock: <span className="font-semibold text-zinc-100">{row.quantity}</span>
      </p>

      {failure && <FormAlert title={failure.title} message={failure.message} tone={failure.tone} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField label="Action" error={errors.direction?.message} {...register('direction')}>
          <option value="remove">Remove stock</option>
          <option value="add">Add stock</option>
        </SelectField>
        <TextField label="How many?" required inputMode="numeric" placeholder="1" error={errors.quantity?.message} {...register('quantity')} />
      </div>

      <SelectField label="Reason" required error={errors.reason?.message} {...register('reason')}>
        <option value="DAMAGED">Damaged or lost</option>
        <option value="MISCOUNT">Counting correction</option>
        <option value="FOUND">Found</option>
        <option value="OTHER">Other (explain below)</option>
      </SelectField>

      <TextAreaField label="Note" rows={2} placeholder="Optional, but helpful later" error={errors.note?.message} {...register('note')} />

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onClose} disabled={adjust.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={adjust.isPending}>
          Save adjustment
        </Button>
      </div>
    </form>
  );
}
