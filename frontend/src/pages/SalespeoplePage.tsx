import { Pencil, Plus, Power, PowerOff, UserRound } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import QueryError from '../components/ui/QueryError';
import { useAuth } from '../features/auth/useAuth';
import { useLocations } from '../features/locations/useLocations';
import SalespersonFormModal from '../features/salespeople/SalespersonFormModal';
import { useSalespeople, useSetSalespersonActive } from '../features/salespeople/useSalespeople';
import type { SalespersonRecord } from '../types/api';

const CONTROL =
  'rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-base sm:text-sm text-zinc-200 outline-none transition focus:border-gold-500/70 focus:ring-4 focus:ring-gold-500/15 [&>option]:bg-ink-900';

export default function SalespeoplePage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';

  const { data: locations = [] } = useLocations();
  const showrooms = locations.filter((location) => location.type === 'SHOWROOM');
  const [showroomId, setShowroomId] = useState('');

  const { data, isPending, error, refetch } = useSalespeople({ includeInactive: true, ...(isOwner && showroomId && { showroomId }) });
  const setActive = useSetSalespersonActive();

  const [editing, setEditing] = useState<SalespersonRecord | null | 'new'>(null);
  const [toggling, setToggling] = useState<SalespersonRecord | null>(null);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title="Salespeople"
        description={
          isOwner
            ? 'The people who sell in each showroom. They are chosen in "Sold by" on every sale.'
            : 'The people in your showroom who make sales. Choose one in "Sold by" on every sale, so the owner can see who sold what.'
        }
        actions={
          <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setEditing('new')}>
            Add salesperson
          </Button>
        }
      />

      {isOwner && (
        <select aria-label="Filter by showroom" value={showroomId} onChange={(event) => setShowroomId(event.target.value)} className={`${CONTROL} sm:w-72`}>
          <option value="">All showrooms</option>
          {showrooms.map((showroom) => (
            <option key={showroom.id} value={showroom.id}>
              {showroom.name}
            </option>
          ))}
        </select>
      )}

      {isPending ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-16 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : error || !data ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="No salespeople yet"
          text="Add the people who sell in your showroom. You need at least one before you can record a sale."
          action={<Button onClick={() => setEditing('new')}>Add salesperson</Button>}
        />
      ) : (
        <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-ink-900">
          {data.map((person) => (
            <li key={person.id} className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 ${person.isActive ? '' : 'opacity-60'}`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-500/15 font-display text-lg font-semibold text-gold-300 ring-1 ring-gold-500/30">
                {person.fullName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-zinc-100">{person.fullName}</p>
                <p className="truncate text-xs text-zinc-500">
                  {isOwner && `${person.showroom.name} · `}
                  {person.phone ?? 'No phone'} · {person.salesCount} sale{person.salesCount === 1 ? '' : 's'}
                </p>
              </div>
              <Badge tone={person.isActive ? 'green' : 'zinc'}>{person.isActive ? 'Active' : 'Inactive'}</Badge>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" icon={<Pencil className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => setEditing(person)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={person.isActive ? <PowerOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Power className="h-3.5 w-3.5" aria-hidden="true" />}
                  onClick={() => setToggling(person)}
                >
                  {person.isActive ? 'Deactivate' : 'Reactivate'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <SalespersonFormModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        person={editing === 'new' ? null : editing}
        askShowroom={isOwner}
        defaultShowroomId={showroomId}
      />

      <ConfirmDialog
        open={toggling !== null}
        onClose={() => setToggling(null)}
        title={toggling?.isActive ? 'Deactivate this person?' : 'Reactivate this person?'}
        message={
          toggling?.isActive
            ? `${toggling.fullName} will no longer appear in "Sold by". Their past sales keep their name. People are never deleted.`
            : `${toggling?.fullName ?? 'This person'} will appear in "Sold by" again.`
        }
        confirmLabel={toggling?.isActive ? 'Deactivate' : 'Reactivate'}
        tone={toggling?.isActive ? 'danger' : 'primary'}
        onConfirm={async () => {
          if (!toggling) return;
          await setActive.mutateAsync({ id: toggling.id, isActive: !toggling.isActive });
          toast.success(toggling.isActive ? 'Deactivated' : 'Reactivated', { description: toggling.fullName });
        }}
      />
    </div>
  );
}
