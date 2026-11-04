import { KeyRound, LockOpen, LogOut, Pencil, Plus, Search, UserCheck, UserX, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import Pagination from '../components/ui/Pagination';
import QueryError from '../components/ui/QueryError';
import SecretRevealModal from '../components/ui/SecretRevealModal';
import UserFormModal from '../features/users/UserFormModal';
import {
  useForceLogout,
  useResetPassword,
  useSetUserActive,
  useUnlockUser,
  useUsers,
  type UserFilters,
} from '../features/users/useUsers';
import { useAuth } from '../features/auth/useAuth';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { formatDateTime } from '../lib/format';
import type { UserRecord } from '../types/api';
import { ROLE_LABELS, type Role } from '../types/auth';

type Pending =
  | { kind: 'deactivate' | 'activate' | 'logout' | 'reset'; user: UserRecord }
  | null;

const CONTROL =
  'rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-zinc-200 outline-none transition focus:border-gold-500/70 focus:ring-4 focus:ring-gold-500/15 [&>option]:bg-ink-900';

function isLocked(user: UserRecord): boolean {
  return user.lockedUntil !== null && new Date(user.lockedUntil) > new Date();
}

export default function UsersPage() {
  const { user: me } = useAuth();

  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [isActive, setIsActive] = useState<UserFilters['isActive']>('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const { data, isPending, isFetching, error, refetch } = useUsers({ search: debouncedSearch, role, isActive, page });

  const setUserActive = useSetUserActive();
  const resetPassword = useResetPassword();
  const forceLogout = useForceLogout();
  const unlock = useUnlockUser();

  const [editing, setEditing] = useState<UserRecord | null | 'new'>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [secret, setSecret] = useState<{ title: string; who: string; value: string } | null>(null);

  const confirmCopy = {
    deactivate: {
      title: 'Deactivate this account?',
      message: 'The person is signed out everywhere straight away and cannot sign in again until you reactivate the account.',
      label: 'Deactivate',
      danger: true,
    },
    activate: { title: 'Reactivate this account?', message: 'The person will be able to sign in again.', label: 'Reactivate', danger: false },
    logout: {
      title: 'Sign out everywhere?',
      message: 'Every device where this account is signed in will be signed out. They can sign in again with their password.',
      label: 'Sign out everywhere',
      danger: true,
    },
    reset: {
      title: 'Reset the password?',
      message: 'A new temporary password is created and shown to you once. The person is signed out everywhere and any lock is removed.',
      label: 'Reset password',
      danger: true,
    },
  } as const;

  const runPending = async () => {
    if (!pending) return;
    const { kind, user } = pending;
    if (kind === 'deactivate' || kind === 'activate') {
      await setUserActive.mutateAsync({ id: user.id, isActive: kind === 'activate' });
      toast.success(kind === 'activate' ? 'Account reactivated' : 'Account deactivated', { description: user.fullName });
    } else if (kind === 'logout') {
      const { signedOut } = await forceLogout.mutateAsync(user.id);
      toast.success('Signed out everywhere', {
        description: signedOut === 0 ? `${user.fullName} had no active sessions.` : `${user.fullName} was signed out of ${signedOut} session${signedOut === 1 ? '' : 's'}.`,
      });
    } else {
      const { temporaryPassword } = await resetPassword.mutateAsync(user.id);
      setSecret({ title: 'Password reset', who: user.fullName, value: temporaryPassword });
    }
  };

  const handleUnlock = async (user: UserRecord) => {
    try {
      await unlock.mutateAsync(user.id);
      toast.success('Account unlocked', { description: user.fullName });
    } catch {
      /* shown as a toast by the global handler */
    }
  };

  const resetFilters = () => {
    setSearch('');
    setRole('');
    setIsActive('');
    setPage(1);
  };
  const filtered = search !== '' || role !== '' || isActive !== '';

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title="Users"
        description="Everyone who can sign in: the owner, the workshop and store managers, and one shared login per showroom."
        actions={
          <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setEditing('new')}>
            Create account
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email"
            aria-label="Search users"
            className={`${CONTROL} w-full pl-10`}
          />
        </div>
        <select
          aria-label="Filter by role"
          value={role}
          onChange={(event) => {
            setRole(event.target.value as Role | '');
            setPage(1);
          }}
          className={CONTROL}
        >
          <option value="">All roles</option>
          {(Object.keys(ROLE_LABELS) as Role[]).map((value) => (
            <option key={value} value={value}>
              {ROLE_LABELS[value]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by status"
          value={isActive}
          onChange={(event) => {
            setIsActive(event.target.value as UserFilters['isActive']);
            setPage(1);
          }}
          className={CONTROL}
        >
          <option value="">Any status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {isPending ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="h-16 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : error && !data ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : data && data.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={filtered ? 'No accounts match your search' : 'No accounts yet'}
          text={filtered ? 'Try a different search or clear the filters.' : 'Create the first account.'}
          action={filtered ? <Button variant="secondary" onClick={resetFilters}>Clear filters</Button> : undefined}
        />
      ) : data ? (
        <div className={isFetching ? 'opacity-70 transition' : 'transition'}>
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-ink-900">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Person</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Role</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Location</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Last sign-in</th>
                  <th scope="col" className="px-5 py-3.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.items.map((person) => {
                  const self = person.id === me?.id;
                  const locked = isLocked(person);
                  return (
                    <tr key={person.id} className={person.isActive ? '' : 'opacity-60'}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-500/15 font-display text-base font-semibold text-gold-300 ring-1 ring-gold-500/30">
                            {person.fullName.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-zinc-100">
                              {person.fullName}
                              {self && <span className="ml-2 text-xs text-gold-400">(you)</span>}
                            </p>
                            <p className="truncate text-xs text-zinc-500">{person.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-zinc-300">{ROLE_LABELS[person.role]}</td>
                      <td className="px-5 py-4 text-zinc-400">{person.location?.name ?? 'All locations'}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge tone={person.isActive ? 'green' : 'zinc'}>{person.isActive ? 'Active' : 'Inactive'}</Badge>
                          {locked && <Badge tone="amber">Locked</Badge>}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-zinc-500">{formatDateTime(person.lastLoginAt)}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <IconButton label="Edit" onClick={() => setEditing(person)} icon={Pencil} />
                          {locked && <IconButton label="Unlock" onClick={() => void handleUnlock(person)} icon={LockOpen} />}
                          {!self && <IconButton label="Reset password" onClick={() => setPending({ kind: 'reset', user: person })} icon={KeyRound} />}
                          {!self && person.activeSessions > 0 && (
                            <IconButton label="Sign out everywhere" onClick={() => setPending({ kind: 'logout', user: person })} icon={LogOut} />
                          )}
                          {!self &&
                            (person.isActive ? (
                              <IconButton label="Deactivate" danger onClick={() => setPending({ kind: 'deactivate', user: person })} icon={UserX} />
                            ) : (
                              <IconButton label="Reactivate" onClick={() => setPending({ kind: 'activate', user: person })} icon={UserCheck} />
                            ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
        </div>
      ) : null}

      <UserFormModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        user={editing === 'new' ? null : editing}
        onCreated={({ user, temporaryPassword }) => {
          toast.success('Account created', { description: user.fullName });
          setSecret({ title: 'Account created', who: `${user.fullName} (${user.email})`, value: temporaryPassword });
        }}
      />

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title={pending ? confirmCopy[pending.kind].title : ''}
        message={pending ? `${pending.user.fullName}: ${confirmCopy[pending.kind].message}` : ''}
        confirmLabel={pending ? confirmCopy[pending.kind].label : ''}
        tone={pending && confirmCopy[pending.kind].danger ? 'danger' : 'primary'}
        onConfirm={runPending}
      />

      <SecretRevealModal
        open={secret !== null}
        onClose={() => setSecret(null)}
        title={secret?.title ?? ''}
        who={secret?.who ?? ''}
        secret={secret?.value ?? ''}
      />
    </div>
  );
}

function IconButton({
  label,
  icon: Icon,
  onClick,
  danger = false,
}: {
  label: string;
  icon: typeof Pencil;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`rounded-lg p-2 transition ${danger ? 'text-zinc-500 hover:bg-red-500/10 hover:text-red-300' : 'text-zinc-500 hover:bg-white/5 hover:text-gold-300'}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
