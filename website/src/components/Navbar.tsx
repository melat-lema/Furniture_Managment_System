import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from 'framer-motion';
import { Menu, Phone, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSite } from '../hooks/useSite';
import { telHref } from '../lib/format';
import { LinkButton } from './ui/Button';

const LINKS = [
  { id: 'collections', label: 'Collections' },
  { id: 'craft', label: 'Our craft' },
  { id: 'process', label: 'Journey' },
  { id: 'showrooms', label: 'Showrooms' },
  { id: 'contact', label: 'Contact' },
];

export default function Navbar() {
  const { phone } = useSite();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [active, setActive] = useState('');

  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 28, restDelta: 0.001 });

  // the bar hides while you scroll down and returns when you scroll up
  useMotionValueEvent(scrollY, 'change', (latest) => {
    const previous = scrollY.getPrevious() ?? 0;
    setScrolled(latest > 40);
    setHidden(latest > 240 && latest > previous && !open);
  });

  // highlight the link of the section being read
  useEffect(() => {
    const sections = LINKS.map((link) => document.getElementById(link.id)).filter((node): node is HTMLElement => node !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  // lock the page behind the open menu, and let Escape close it
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: hidden ? -90 : 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${scrolled || open ? 'glass border-x-0 border-t-0' : 'border-b border-transparent'}`}
      >
        <nav className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8" aria-label="Main">
          <a href="#top" className="flex items-center" aria-label="Gorgeous Furniture, back to the top" onClick={() => setOpen(false)}>
            <img src="/logo.png" alt="Gorgeous Furniture" className="h-10 w-auto sm:h-11" />
          </a>

          <ul className="hidden items-center gap-9 lg:flex">
            {LINKS.map((link) => (
              <li key={link.id}>
                <a
                  href={`#${link.id}`}
                  className={`relative py-2 text-sm font-medium tracking-wide transition-colors hover:text-white ${active === link.id ? 'text-gold-300' : 'text-zinc-400'}`}
                >
                  {link.label}
                  {active === link.id && <motion.span layoutId="nav-underline" className="absolute inset-x-0 -bottom-0.5 h-px bg-gold-400" />}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3">
            {phone && (
              <a href={telHref(phone)} className="hidden items-center gap-2 text-sm font-medium text-zinc-300 transition hover:text-gold-300 xl:inline-flex">
                <Phone className="h-4 w-4" aria-hidden="true" />
                {phone}
              </a>
            )}
            <LinkButton href="#showrooms" className="px-5! py-2.5! max-sm:hidden">
              Visit a showroom
            </LinkButton>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-zinc-100 transition hover:border-gold-400/60 lg:hidden"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>
        <motion.div style={{ scaleX: progress }} className="h-px origin-left bg-linear-to-r from-gold-600 via-gold-300 to-gold-600" />
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 flex flex-col justify-center bg-ink-950/95 px-8 backdrop-blur-xl lg:hidden"
          >
            <ul className="space-y-2">
              {LINKS.map((link, index) => (
                <motion.li
                  key={link.id}
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 + index * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <a href={`#${link.id}`} onClick={() => setOpen(false)} className="block py-2 font-display text-5xl font-semibold text-white transition hover:text-gold-300">
                    {link.label}
                  </a>
                </motion.li>
              ))}
            </ul>
            {phone && (
              <a href={telHref(phone)} className="mt-10 inline-flex items-center gap-3 text-lg text-gold-300">
                <Phone className="h-5 w-5" aria-hidden="true" /> {phone}
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
