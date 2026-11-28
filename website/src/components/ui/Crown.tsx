/** The crown from the logo, as a small icon that takes the text colour. */
export default function Crown({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M3 8l4.5 4L12 4l4.5 8L21 8l-2 10H5L3 8zm2.2 12h13.6v2H5.2v-2z" />
    </svg>
  );
}
