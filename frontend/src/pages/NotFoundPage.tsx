import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-500/10 text-gold-400 ring-1 ring-gold-500/30">
        <Compass className="h-8 w-8" aria-hidden="true" />
      </span>
      <h1 className="mt-6 font-display text-4xl font-semibold text-white">Page not found</h1>
      <p className="mt-2 text-sm text-zinc-400">The page you are looking for does not exist or has moved.</p>
      <Link
        to="/"
        className="mt-6 rounded-xl bg-gold-500 px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-gold-400"
      >
        Back to the dashboard
      </Link>
    </div>
  );
}
