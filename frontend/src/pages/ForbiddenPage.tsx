import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ForbiddenPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 ring-1 ring-red-500/30">
        <ShieldAlert className="h-8 w-8" aria-hidden="true" />
      </span>
      <h1 className="mt-6 font-display text-4xl font-semibold text-white">No access</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Your account does not have permission to open this page. If you think this is a mistake, ask the owner.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-xl bg-gold-500 px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-gold-400"
      >
        Back to the dashboard
      </Link>
    </div>
  );
}
