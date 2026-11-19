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
import type { SalespersonRecord } from '../../types/api';
import { useLocations } from '../locations/useLocations';
import { useSaveSalesperson } from './useSalespeople';

const schema = z.object({
  fullName: z.string().trim().min(2, 'Enter the name (at least 2 characters).').max(80, 'That name is too long.'),
  phone: z
    .string()
    .trim()
    .refine((value) => value === '' || /^[+\d][\d\s-]{5,19}$/.test(value), 'Enter a valid phone number, for example +251 911 000000.'),
  showroomId: z.string(),
});
type Values = z.infer<typeof schema>;
const FIELDS = ['fullName', 'phone', 'showroomId'] as const;

interface SalespersonFormModalProps {
  open: boolean;
  onClose: () => void;
  /** null = add a new person */
  person: SalespersonRecord | null;
  /** The owner must choose which showroom; a showroom account always uses its own. */
  askShowroom: boolean;
  /** pre-selected showroom for the owner */
  defaultShowroomId?: string;
}

export default function SalespersonFormModal(props: SalespersonFormModalProps) {
  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      size="sm"
      title={props.person ? 'Edit salesperson' : 'Add a salesperson'}
      description={props.person ? undefined : 'This person will appear in "Sold by" when a sale is recorded.'}
    >
      <SalespersonForm {...props} />
    </Modal>
  );
}

function SalespersonForm({ person, askShowroom, defaultShowroomId, onClose }: SalespersonFormModalProps) {
  const save = useSaveSalesperson();
  const { data: locations = [] } = useLocations();
  const showrooms = locations.filter((location) => location.type === 'SHOWROOM' && location.isActive);
  const [failure, setFailure] = useState<FormFailure | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: person?.fullName ?? '', phone: person?.phone ?? '', showroomId: defaultShowroomId ?? '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    if (askShowroom && !person && values.showroomId === '') {
      setError('showroomId', { type: 'manual', message: 'Choose the showroom.' });
      return;
    }
    try {
      await save.mutateAsync({
        id: person?.id,
        fullName: values.fullName,
        phone: values.phone || null,
        ...(askShowroom && !person && { showroomId: values.showroomId }),
      });
      toast.success(person ? 'Salesperson updated' : 'Salesperson added', { description: values.fullName });
      onClose();
    } catch (error) {
      setFailure(handleFormError(error, setError, FIELDS));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {failure && <FormAlert title={failure.title} message={failure.message} tone={failure.tone} />}

      {askShowroom && !person && (
        <SelectField label="Showroom" required error={errors.showroomId?.message} {...register('showroomId')}>
          <option value="">Choose the showroom</option>
          {showrooms.map((showroom) => (
            <option key={showroom.id} value={showroom.id}>
              {showroom.name}
            </option>
          ))}
        </SelectField>
      )}

      <TextField label="Full name" required autoFocus error={errors.fullName?.message} {...register('fullName')} />
      <TextField label="Phone (optional)" type="tel" placeholder="+251 911 000000" error={errors.phone?.message} {...register('phone')} />

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          {person ? 'Save changes' : 'Add salesperson'}
        </Button>
      </div>
    </form>
  );
}
