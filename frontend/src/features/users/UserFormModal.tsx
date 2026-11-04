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
import type { UserRecord } from '../../types/api';
import { ROLE_LABELS, type LocationType, type Role } from '../../types/auth';
import { useLocations } from '../locations/useLocations';
import { useSaveUser, type CreatedUser } from './useUsers';

const ROLE_VALUES = ['OWNER', 'WORKSHOP_MANAGER', 'STORE_MANAGER', 'SHOWROOM'] as const satisfies readonly Role[];

const LOCATION_TYPE_FOR_ROLE: Record<Exclude<Role, 'OWNER'>, LocationType> = {
  WORKSHOP_MANAGER: 'WORKSHOP',
  STORE_MANAGER: 'STORE',
  SHOWROOM: 'SHOWROOM',
};

const schema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter the full name.').max(100, 'That name is too long.'),
    email: z.string().trim().min(1, 'Enter an email address.').email('Enter a valid email address.'),
    phone: z
      .string()
      .trim()
      .refine((value) => value === '' || /^[+\d][\d\s-]{5,19}$/.test(value), 'Enter a valid phone number, for example +251 911 000000.'),
    role: z.enum(ROLE_VALUES),
    locationId: z.string(),
    telegramChatId: z
      .string()
      .trim()
      .refine((value) => value === '' || /^-?\d{5,20}$/.test(value), 'A Telegram chat id is a number.'),
  })
  .refine((values) => values.role === 'OWNER' || values.locationId !== '', {
    message: 'Choose a location for this role.',
    path: ['locationId'],
  });
type Values = z.infer<typeof schema>;
const FIELDS = ['fullName', 'email', 'phone', 'role', 'locationId', 'telegramChatId'] as const;

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  /** null = create a new user */
  user: UserRecord | null;
  /** Called after a NEW user is created, with the one-time temporary password. */
  onCreated: (result: CreatedUser) => void;
}

export default function UserFormModal({ open, onClose, user, onCreated }: UserFormModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={user ? 'Edit account' : 'Create an account'}
      description={user ? user.email : 'A temporary password is generated for you.'}
    >
      <UserForm user={user} onClose={onClose} onCreated={onCreated} />
    </Modal>
  );
}

function UserForm({ user, onClose, onCreated }: Omit<UserFormModalProps, 'open'>) {
  const save = useSaveUser();
  const { data: locations = [] } = useLocations();
  const [failure, setFailure] = useState<FormFailure | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      role: user?.role ?? 'SHOWROOM',
      locationId: user?.locationId ?? '',
      telegramChatId: user?.telegramChatId ?? '',
    },
  });

  const role = watch('role');
  const wantedType = role === 'OWNER' ? null : LOCATION_TYPE_FOR_ROLE[role];
  const locationOptions = locations.filter(
    (location) => location.type === wantedType && (location.isActive || location.id === user?.locationId),
  );

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      const result = await save.mutateAsync({
        id: user?.id,
        fullName: values.fullName,
        email: values.email,
        phone: values.phone || null,
        role: values.role,
        locationId: values.role === 'OWNER' ? null : values.locationId,
        telegramChatId: values.telegramChatId || null,
      });
      if ('temporaryPassword' in result) {
        onCreated(result);
      } else {
        toast.success('Account updated', { description: values.fullName });
      }
      onClose();
    } catch (error) {
      setFailure(handleFormError(error, setError, FIELDS));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {failure && <FormAlert title={failure.title} message={failure.message} tone={failure.tone} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Full name" required error={errors.fullName?.message} {...register('fullName')} />
        <TextField
          label="Email (used to sign in)"
          required
          type="email"
          autoCapitalize="none"
          spellCheck={false}
          error={errors.email?.message}
          {...register('email')}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Role"
          required
          error={errors.role?.message}
          {...register('role', { onChange: () => setValue('locationId', '') })}
        >
          {ROLE_VALUES.map((value) => (
            <option key={value} value={value}>
              {ROLE_LABELS[value]}
            </option>
          ))}
        </SelectField>

        {role === 'OWNER' ? (
          <TextField label="Location" value="All locations" readOnly disabled hint="The owner is not tied to one location." />
        ) : (
          <SelectField
            label="Location"
            required
            error={errors.locationId?.message}
            hint={locationOptions.length === 0 ? `Create a ${wantedType?.toLowerCase()} first on the Locations page.` : undefined}
            {...register('locationId')}
          >
            <option value="">Choose a {wantedType?.toLowerCase()}</option>
            {locationOptions.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </SelectField>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Phone" type="tel" placeholder="+251 911 000000" error={errors.phone?.message} {...register('phone')} />
        <TextField
          label="Telegram chat id"
          inputMode="numeric"
          hint="Optional. Used later for alerts."
          error={errors.telegramChatId?.message}
          {...register('telegramChatId')}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          {user ? 'Save changes' : 'Create account'}
        </Button>
      </div>
    </form>
  );
}
