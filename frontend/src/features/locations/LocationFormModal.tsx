import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { SelectField, TextField } from '../../components/form/Fields';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import FormAlert from '../../components/FormAlert';
import { handleFormError, type FormFailure } from '../../lib/form-errors';
import type { LocationRecord } from '../../types/api';
import { useSaveLocation } from './useLocations';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter a name (at least 2 characters).').max(80, 'That name is too long.'),
  type: z.enum(['WORKSHOP', 'STORE', 'SHOWROOM']),
  address: z.string().trim().max(200, 'The address is too long.'),
  phone: z.string().trim().max(40, 'The phone number is too long.'),
});
type Values = z.infer<typeof schema>;
const FIELDS = ['name', 'type', 'address', 'phone'] as const;

const TYPE_LABEL = { WORKSHOP: 'Workshop', STORE: 'Store', SHOWROOM: 'Showroom' } as const;

interface LocationFormModalProps {
  open: boolean;
  onClose: () => void;
  /** null = create a new location */
  location: LocationRecord | null;
}

export default function LocationFormModal({ open, onClose, location }: LocationFormModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={location ? 'Edit location' : 'Add a location'}
      description={location ? undefined : 'A workshop, a store or a showroom.'}
    >
      <LocationForm location={location} onClose={onClose} />
    </Modal>
  );
}

function LocationForm({ location, onClose }: { location: LocationRecord | null; onClose: () => void }) {
  const save = useSaveLocation();
  const [failure, setFailure] = useState<FormFailure | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: location?.name ?? '',
      type: location?.type ?? 'SHOWROOM',
      address: location?.address ?? '',
      phone: location?.phone ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await save.mutateAsync({
        id: location?.id,
        name: values.name,
        type: location ? undefined : values.type,
        address: values.address || null,
        phone: values.phone || null,
      });
      toast.success(location ? 'Location updated' : 'Location added', { description: values.name });
      onClose();
    } catch (error) {
      setFailure(handleFormError(error, setError, FIELDS));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {failure && <FormAlert title={failure.title} message={failure.message} tone={failure.tone} />}

      <TextField label="Name" required placeholder="For example Bole Showroom" error={errors.name?.message} {...register('name')} />

      {location ? (
        <TextField
          label="Type"
          value={TYPE_LABEL[location.type]}
          readOnly
          disabled
          hint="The type cannot be changed after the location is created."
        />
      ) : (
        <SelectField label="Type" required error={errors.type?.message} {...register('type')}>
          <option value="WORKSHOP">Workshop</option>
          <option value="STORE">Store</option>
          <option value="SHOWROOM">Showroom</option>
        </SelectField>
      )}

      <TextField label="Address" placeholder="Street, area, city" error={errors.address?.message} {...register('address')} />
      <TextField label="Phone" type="tel" placeholder="+251 911 000000" error={errors.phone?.message} {...register('phone')} />

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          {location ? 'Save changes' : 'Add location'}
        </Button>
      </div>
    </form>
  );
}
