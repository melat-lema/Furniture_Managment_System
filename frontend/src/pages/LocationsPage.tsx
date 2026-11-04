import { Armchair, Building2, Hammer, MapPin, Pencil, Phone, Plus, Power, PowerOff, Store, Users, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import QueryError from '../components/ui/QueryError';
import LocationFormModal from '../features/locations/LocationFormModal';
import { useLocations, useSetLocationActive } from '../features/locations/useLocations';
import type { LocationRecord } from '../types/api';
import type { LocationType } from '../types/auth';

const TYPE_META: Record<LocationType, { label: string; icon: LucideIcon }> = {
  WORKSHOP: { label: 'Workshop', icon: Hammer },
  STORE: { label: 'Store', icon: Store },
  SHOWROOM: { label: 'Showroom', icon: Armchair },
};

export default function LocationsPage() {
  const { data, isPending, error, refetch } = useLocations();
  const setActive = useSetLocationActive();

  const [editing, setEditing] = useState<LocationRecord | null | 'new'>(null);
  const [toggling, setToggling] = useState<LocationRecord | null>(null);

  return (
    <div className="space-y-8 animate-fade-up">
      <PageHeader
        title="Locations"
        description="Your workshop, store and showrooms."
        actions={
          <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setEditing('new')}>
            Add location
          </Button>
        }
      />

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-44 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : error || !data ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No locations yet"
          text="Add your workshop, your store and each showroom."
          action={<Button onClick={() => setEditing('new')}>Add location</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((location) => {
            const { label, icon: Icon } = TYPE_META[location.type];
            return (
              <article
                key={location.id}
                className={`flex flex-col rounded-2xl border bg-ink-900 p-5 ${location.isActive ? 'border-white/10' : 'border-white/5 opacity-70'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-500/10 text-gold-400 ring-1 ring-gold-500/25">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="flex gap-2">
                    <Badge tone="gold">{label}</Badge>
                    <Badge tone={location.isActive ? 'green' : 'zinc'}>{location.isActive ? 'Active' : 'Inactive'}</Badge>
                  </div>
                </div>

                <h2 className="mt-4 text-lg font-semibold text-zinc-100">{location.name}</h2>
                <dl className="mt-2 space-y-1.5 text-sm text-zinc-500">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <dt className="sr-only">Address</dt>
                    <dd>{location.address ?? 'No address yet'}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <dt className="sr-only">Phone</dt>
                    <dd>{location.phone ?? 'No phone yet'}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <dt className="sr-only">Accounts</dt>
                    <dd>
                      {location.userCount} account{location.userCount === 1 ? '' : 's'}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5 flex gap-2 border-t border-white/5 pt-4">
                  <Button variant="secondary" size="sm" icon={<Pencil className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => setEditing(location)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={
                      location.isActive ? (
                        <PowerOff className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Power className="h-3.5 w-3.5" aria-hidden="true" />
                      )
                    }
                    onClick={() => setToggling(location)}
                  >
                    {location.isActive ? 'Deactivate' : 'Reactivate'}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <LocationFormModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        location={editing === 'new' ? null : editing}
      />

      <ConfirmDialog
        open={toggling !== null}
        onClose={() => setToggling(null)}
        title={toggling?.isActive ? 'Deactivate this location?' : 'Reactivate this location?'}
        message={
          toggling?.isActive
            ? `${toggling.name} will be switched off and the people who sign in there will be blocked. Its history stays safe. A location that still holds stock cannot be deactivated.`
            : `${toggling?.name ?? 'This location'} will be switched back on.`
        }
        confirmLabel={toggling?.isActive ? 'Deactivate' : 'Reactivate'}
        tone={toggling?.isActive ? 'danger' : 'primary'}
        onConfirm={async () => {
          if (!toggling) return;
          await setActive.mutateAsync({ id: toggling.id, isActive: !toggling.isActive });
          toast.success(toggling.isActive ? 'Location deactivated' : 'Location reactivated', { description: toggling.name });
        }}
      />
    </div>
  );
}
