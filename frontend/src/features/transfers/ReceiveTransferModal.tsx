import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import FormAlert from '../../components/FormAlert';
import { TextAreaField, TextField } from '../../components/form/Fields';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { handleFormError, type FormFailure } from '../../lib/form-errors';
import type { TransferDetail } from '../../types/api';
import { useReceiveTransfer } from './useTransfers';

const WHOLE = /^\d{1,6}$/;

const schema = z
  .object({
    note: z.string().trim().max(300, 'The note is too long (300 characters at most).'),
    items: z.array(
      z
        .object({
          productId: z.string(),
          name: z.string(),
          sent: z.number(),
          received: z.string().trim().regex(WHOLE, 'Enter a whole number (0 or more).'),
        })
        .refine((line) => !WHOLE.test(line.received) || Number(line.received) <= line.sent, {
          message: 'You cannot receive more than was sent.',
          path: ['received'],
        }),
    ),
  })
  .refine((values) => values.note !== '' || values.items.every((line) => Number(line.received) === line.sent), {
    message: 'Please explain the difference, for example: 2 arrived damaged, 1 is missing.',
    path: ['note'],
  });
type Values = z.infer<typeof schema>;

interface ReceiveTransferModalProps {
  open: boolean;
  onClose: () => void;
  transfer: TransferDetail;
}

export default function ReceiveTransferModal({ open, onClose, transfer }: ReceiveTransferModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Confirm what arrived"
      description={`${transfer.code} from ${transfer.fromLocation.name}. Count the goods and enter what you actually received.`}
    >
      <ReceiveForm transfer={transfer} onClose={onClose} />
    </Modal>
  );
}

function ReceiveForm({ transfer, onClose }: { transfer: TransferDetail; onClose: () => void }) {
  const receive = useReceiveTransfer();
  const [failure, setFailure] = useState<FormFailure | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      note: '',
      items: transfer.items.map((item) => ({
        productId: item.productId,
        name: item.product.name,
        sent: item.qtySent,
        received: String(item.qtySent), // most of the time everything arrives, so start with "all of it"
      })),
    },
  });
  const { fields } = useFieldArray({ control, name: 'items' });
  const watched = useWatch({ control, name: 'items' });
  const differences = watched.filter((line) => WHOLE.test(line.received) && Number(line.received) !== line.sent).length;

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      const result = await receive.mutateAsync({
        id: transfer.id,
        items: values.items.map((line) => ({ productId: line.productId, quantityReceived: Number(line.received) })),
        note: values.note || null,
      });
      if (result.status === 'RECEIVED_WITH_DISCREPANCY') {
        toast.warning('Received with differences', { description: 'The sender and the owner can see the difference.' });
      } else {
        toast.success('Transfer received', { description: `${result.unitsReceived ?? 0} items added to your stock.` });
      }
      onClose();
    } catch (error) {
      setFailure(handleFormError(error, setError, ['items', 'note']));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {failure && <FormAlert title={failure.title} message={failure.message} tone={failure.tone} />}

      <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
        {fields.map((field, index) => (
          <li key={field.id} className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1 pt-2">
              <p className="text-sm text-zinc-200">{field.name}</p>
              <p className="text-xs text-zinc-500">Sent: {field.sent}</p>
            </div>
            <div className="w-28 shrink-0">
              <TextField
                label=""
                aria-label={`Received quantity for ${field.name}`}
                inputMode="numeric"
                error={errors.items?.[index]?.received?.message}
                {...register(`items.${index}.received`)}
              />
            </div>
          </li>
        ))}
      </ul>

      {differences > 0 && (
        <FormAlert
          tone="warning"
          title={`${differences} product${differences === 1 ? '' : 's'} differ${differences === 1 ? 's' : ''} from what was sent`}
          message="Only what you enter here is added to your stock. Please explain the difference below."
        />
      )}

      <TextAreaField
        label={differences > 0 ? 'What happened? (required)' : 'Note (optional)'}
        rows={2}
        placeholder="For example: 1 sofa arrived with a torn cover"
        error={errors.note?.message}
        {...register('note')}
      />

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onClose} disabled={receive.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={receive.isPending}>
          Confirm received
        </Button>
      </div>
    </form>
  );
}
