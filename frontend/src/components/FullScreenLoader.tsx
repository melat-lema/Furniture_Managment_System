import BrandLogo from './BrandLogo';

export default function FullScreenLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-ink-950" role="status">
      <BrandLogo variant="mark" className="h-20 w-auto animate-pulse" />
      <p className="text-sm text-zinc-500">Loading…</p>
    </div>
  );
}
