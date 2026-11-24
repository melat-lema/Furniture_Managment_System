import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import FormAlert from '../../components/FormAlert';
import { SelectField, TextField } from '../../components/form/Fields';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { handleFormError, type FormFailure } from '../../lib/form-errors';
import type { SaleDetail } from '../../types/api';
import { useSalespeople } from '../salespeople/useSalespeople';
import { useUpdateSale } from './useSales';

const schema = z.object({
  customerName: z.string().trim().max(100, 'The customer name is too long.'),
  customerPhone: z
    .string()
    .trim()
    .refine((value) => value === '' || /^[+\d][\d\s-]{5,19}$/.test(value), 'Enter a valid phone number, for example +251 911 000000.'),
  salespersonId: z.string().min(1, 'Choose who made the sale.'),
});
type Values = z.infer<typeof schema>;
const FIELDS = ['customerName', 'customerPhone', 'salespersonId'] as const;

interface EditSaleModalProps {
  open: boolean;
  onClose: () => void;
  sale: SaleDetail;
}

export default function EditSaleModal({ open, onClose, sale }: EditSaleModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Correct sale details"
      description="Products and prices cannot be changed. If they are wrong, cancel the sale and record it again."
    >
      <EditForm sale={sale} onClose={onClose} />
    </Modal>
  );
}

function EditForm({ sale, onClose }: { sale: SaleDetail; onClose: () => void }) {
  const update = useUpdateSale();
  const { data: people = [] } = useSalespeople({ showroomId: sale.location.id });
  const [failure, setFailure] = useState<FormFailure | null>(null);

  // the person who sold it stays in the list even if they have since been deactivated
  const options = people.some((person) => person.id === sale.salesperson.id)
    ? people
    : [{ id: sale.salesperson.id, fullName: sale.salesperson.fullName }, ...people];

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { customerName: sale.customerName ?? '', customerPhone: sale.customerPhone ?? '', salespersonId: sale.salesperson.id },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await update.mutateAsync({
        id: sale.id,
        customerName: values.customerName || null,
        customerPhone: values.customerPhone || null,
        salespersonId: values.salespersonId,
      });
      toast.success('Sale updated', { description: sale.code });
      onClose();
    } catch (error) {
      setFailure(handleFormError(error, setError, FIELDS));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {failure && <FormAlert title={failure.title} message={failure.message} tone={failure.tone} />}
      <SelectField label="Sold by" required error={errors.salespersonId?.message} {...register('salespersonId')}>
        {options.map((person) => (
          <option key={person.id} value={person.id}>
            {person.fullName}
          </option>
        ))}
      </SelectField>
      <TextField label="Customer name" error={errors.customerName?.message} {...register('customerName')} />
      <TextField label="Customer phone" type="tel" placeholder="+251 911 000000" error={errors.customerPhone?.message} {...register('customerPhone')} />
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onClose} disabled={update.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={update.isPending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
