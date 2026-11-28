import { ArrowUp, ArrowUpRight } from 'lucide-react';
import { useSite } from '../hooks/useSite';
import { site } from '../lib/config';
import { telHref } from '../lib/format';

const LINKS = [
  { href: '#collections', label: 'Collections' },
  { href: '#craft', label: 'Our craft' },
  { href: '#process', label: 'The journey' },
  { href: '#showrooms', label: 'Showrooms' },
  { href: '#contact', label: 'Contact' },
];

export default function Footer() {
  const { phone } = useSite();
  const socials = Object.entries(site.social).filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <footer className="relative border-t border-white/5 bg-ink-950 pb-10 pt-20">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <img src="/logo.png" alt="Gorgeous Furniture" className="h-14 w-auto" />
          <p className="mt-5 max-w-xs leading-relaxed text-zinc-500">Furniture built by hand in our own workshop in {site.city}, with gold in the details.</p>
        </div>

        <nav aria-label="Footer">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-400">Explore</p>
          <ul className="mt-5 space-y-3">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="text-zinc-400 transition hover:text-white">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-400">Follow and call</p>
          <ul className="mt-5 space-y-3">
            {phone && (
              <li>
                <a href={telHref(phone)} className="text-zinc-400 transition hover:text-white">
                  {phone}
                </a>
              </li>
            )}
            {socials.map(([name, url]) => (
              <li key={name}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 capitalize text-zinc-400 transition hover:text-white">
                  {name} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-16 flex max-w-7xl flex-wrap items-center justify-between gap-4 border-t border-white/5 px-5 pt-8 text-xs text-zinc-600 sm:px-8">
        <p>© {new Date().getFullYear()} Gorgeous Furniture. All rights reserved.</p>
        <a href="#top" className="inline-flex items-center gap-2 transition hover:text-gold-300">
          Back to top <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
    </footer>
  );
}
