import { MapPin, Navigation, Phone } from 'lucide-react';
import type { PointerEvent } from 'react';
import { LinkButton } from '../components/ui/Button';
import Reveal from '../components/ui/Reveal';
import SectionHeading from '../components/ui/SectionHeading';
import { useSite } from '../hooks/useSite';
import { site } from '../lib/config';
import { mapsHref, telHref } from '../lib/format';

/** A soft light follows the cursor across each card. */
function spotlight(event: PointerEvent<HTMLElement>): void {
  const box = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty('--x', `${event.clientX - box.left}px`);
  event.currentTarget.style.setProperty('--y', `${event.clientY - box.top}px`);
}

export default function Showrooms() {
  const { data, phone } = useSite();

  return (
    <section id="showrooms" className="relative overflow-hidden bg-ink-900 py-28 sm:py-36">
      <div aria-hidden="true" className="absolute -left-40 top-1/3 h-96 w-96 rounded-full bg-gold-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Showrooms"
          title={
            <>
              Come and <span className="text-gold-gradient italic">sit with us.</span>
            </>
          }
          text="Nothing replaces sitting in a piece. Visit a showroom and our team will help you choose."
        />

        {data.showrooms.length === 0 ? (
          <Reveal className="mt-14">
            <div className="rounded-3xl border border-white/10 p-10 text-center text-zinc-400">
              {phone ? (
                <>
                  Call us on{' '}
                  <a href={telHref(phone)} className="font-semibold text-gold-300">
                    {phone}
                  </a>{' '}
                  and we will tell you the nearest showroom.
                </>
              ) : (
                'Our showroom details are coming soon.'
              )}
            </div>
          </Reveal>
        ) : (
          <ul className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.showrooms.map((showroom, index) => (
              <li key={showroom.id}>
                <Reveal delay={(index % 3) * 0.1} y={40}>
                  <article
                    onPointerMove={spotlight}
                    className="group relative h-full overflow-hidden rounded-3xl border border-white/10 bg-ink-850 p-8 transition duration-500 hover:border-gold-500/40"
                  >
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100"
                      style={{ background: 'radial-gradient(320px circle at var(--x, 50%) var(--y, 50%), rgb(226 176 74 / 0.14), transparent 70%)' }}
                    />
                    <div className="relative">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold-500/30 bg-gold-500/10 text-gold-300">
                        <MapPin className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <h3 className="mt-6 font-display text-3xl font-semibold text-white">{showroom.name}</h3>
                      <p className="mt-2 min-h-12 leading-relaxed text-zinc-400">{showroom.address ?? site.city}</p>

                      <div className="mt-8 flex flex-wrap gap-3">
                        <LinkButton
                          href={mapsHref(`${showroom.name} ${showroom.address ?? ''} ${site.city}`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-5! py-2.5!"
                          icon={<Navigation className="h-4 w-4" aria-hidden="true" />}
                        >
                          Directions
                        </LinkButton>
                        {showroom.phone && (
                          <LinkButton href={telHref(showroom.phone)} variant="ghost" className="px-5! py-2.5!" icon={<Phone className="h-4 w-4" aria-hidden="true" />}>
                            Call
                          </LinkButton>
                        )}
                      </div>
                    </div>
                  </article>
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
