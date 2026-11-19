import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import FormAlert from '../../components/FormAlert';
import ReceiptPicker from '../../components/ReceiptPicker';
import { SelectField, TextField } from '../../components/form/Fields';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { toApiError } from '../../lib/errors';
import { handleFormError, type FormFailure } from '../../lib/form-errors';
import { formatMoney } from '../../lib/format';
import type { PaymentMethod, SaleDetail } from '../../types/api';
import { METHOD_LABEL } from './PaymentBadges';
import { useAddPayment } from './useSales';

const METHODS = ['CASH', 'BANK_TRANSFER', 'TELEBIRR', 'CBE_BIRR', 'OTHER'] as const satisfies readonly PaymentMethod[];
const MONEY = /^\d{1,9}(\.\d{1,2})?$/;
const FIELDS = ['amount', 'method', 'referenceNo'] as const;

interface AddPaymentModalProps {
  open: boolean;
  onClose: () => void;
  sale: SaleDetail;
}

export default function AddPaymentModal({ open, onClose, sale }: AddPaymentModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record a payment"
      description={`${sale.code}. Balance to pay: ${formatMoney(sale.balance)}`}
    >
      <PaymentForm sale={sale} onClose={onClose} />
    </Modal>
  );
}

function PaymentForm({ sale, onClose }: { sale: SaleDetail; onClose: () => void }) {
  const add = useAddPayment();
  const balance = Number(sale.balance);
  const [failure, setFailure] = useState<FormFailure | null>(null);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z
        .object({
          amount: z
            .string()
            .trim()
            .regex(MONEY, 'Enter an amount like 5000 or 5000.50.')
            .refine((value) => Number(value) > 0, 'The amount must be more than 0.')
            .refine((value) => Number(value) <= balance + 0.001, `The balance is only ${formatMoney(balance)}.`),
          method: z.enum(METHODS),
          referenceNo: z.string().trim().max(60, 'The reference is too long (60 characters at most).'),
        })
        .refine((values) => values.method === 'CASH' || values.referenceNo !== '', {
          message: 'Enter the transaction or reference number from the receipt.',
          path: ['referenceNo'],
        }),
    [balance],
  );
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { amount: String(Math.round(balance * 100) / 100), method: 'CASH', referenceNo: '' },
  });
  const method = watch('method');
  const needsReceipt = method !== 'CASH';

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    setReceiptError(null);
    if (needsReceipt && !receipt) {
      setReceiptError('Upload the receipt (a photo or a PDF) for this payment.');
      return;
    }
    try {
      await add.mutateAsync({
        saleId: sale.id,
        amount: Number(values.amount),
        method: values.method,
        referenceNo: values.referenceNo || null,
        receipt: needsReceipt ? receipt : null,
      });
      toast.success('Payment recorded', { description: `${formatMoney(values.amount)} for ${sale.code}` });
      onClose();
    } catch (error) {
      const apiError = toApiError(error);
      const forReceipt = apiError.fieldErrors.find((fieldError) => fieldError.field === 'receipt');
      if (forReceipt) setReceiptError(forReceipt.message);
      const shown = handleFormError(error, setError, FIELDS);
      setFailure(forReceipt && !shown ? null : shown);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {failure && <FormAlert title={failure.title} message={failure.message} tone={failure.tone} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Amount (ETB)" required inputMode="decimal" error={errors.amount?.message} {...register('amount')} />
        <SelectField label="How did they pay?" required error={errors.method?.message} {...register('method')}>
          {METHODS.map((value) => (
            <option key={value} value={value}>
              {METHOD_LABEL[value]}
            </option>
          ))}
        </SelectField>
      </div>

      {needsReceipt && (
        <>
          <TextField
            label="Transaction or reference number"
            required
            placeholder="From the receipt or the bank message"
            error={errors.referenceNo?.message}
            {...register('referenceNo')}
          />
          <ReceiptPicker value={receipt} onChange={setReceipt} required error={receiptError} disabled={add.isPending} />
        </>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onClose} disabled={add.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={add.isPending}>
          Record payment
        </Button>
      </div>
    </form>
  );
}
