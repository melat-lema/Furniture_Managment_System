import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { Hammer, Layers, Store } from 'lucide-react';
import { useRef } from 'react';
import Counter from '../components/ui/Counter';
import Crown from '../components/ui/Crown';
import Reveal from '../components/ui/Reveal';
import SectionHeading from '../components/ui/SectionHeading';
import { useSite } from '../hooks/useSite';

const POINTS = [
  { icon: Hammer, title: 'One workshop, full control', text: 'Every piece is shaped, framed and upholstered in our own workshop, so we know it from the first cut to the final stitch.' },
  { icon: Layers, title: 'Gold in the details', text: 'Hand-finished legs, buttons and trims give each design the touch that makes it unmistakably ours.' },
  { icon: Store, title: 'From workshop to showroom', text: 'Your piece moves from our workshop to our store and then to the showroom, where you can sit, touch and choose.' },
];

/** Pictures drift at different speeds as you scroll, which gives the section depth. */
function Visual() {
  const reduce = useReducedMotion();
  const { data } = useSite();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const slow = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 50, reduce ? 0 : -50]);
  const fast = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 110, reduce ? 0 : -110]);
  const spin = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 120]);
  const pictures = data.featured.filter((product) => product.imageUrl).slice(0, 3);

  return (
    <div ref={ref} className="relative mx-auto aspect-[4/5] w-full max-w-md lg:max-w-none">
      <motion.div style={{ rotate: spin }} aria-hidden="true" className="absolute inset-[6%] rounded-full border border-gold-500/20" />
      <motion.div style={{ rotate: spin }} aria-hidden="true" className="absolute inset-[16%] rounded-full border border-dashed border-gold-500/20" />

      {pictures.length >= 2 ? (
        pictures.map((product, index) => (
          <motion.figure
            key={product.id}
            style={{ y: index === 1 ? fast : slow }}
            className={[
              'absolute overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black/60',
              index === 0 ? 'left-0 top-[6%] h-[52%] w-[58%]' : index === 1 ? 'right-0 top-[26%] h-[46%] w-[50%]' : 'bottom-[2%] left-[12%] h-[34%] w-[46%]',
            ].join(' ')}
          >
            <img src={product.imageUrl ?? ''} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent" />
          </motion.figure>
        ))
      ) : (
        <motion.div style={{ y: slow }} className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-[62%] w-[62%] items-center justify-center rounded-[2.5rem] border border-gold-500/25 bg-linear-to-br from-ink-800 to-ink-950">
            <img src="/gf-mark.png" alt="" className="h-1/2 w-auto opacity-90" />
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function Craft() {
  const { data } = useSite();
  const stats = [
    { value: data.stats.showrooms, label: data.stats.showrooms === 1 ? 'Showroom' : 'Showrooms' },
    { value: data.stats.categories, label: 'Collections' },
    { value: data.stats.products, label: 'Pieces' },
  ];

  return (
    <section id="craft" className="relative overflow-hidden bg-ink-950 py-28 sm:py-36">
      <img src="/gf-mark.png" alt="" aria-hidden="true" className="pointer-events-none absolute -right-24 top-10 w-[34rem] max-w-none opacity-[0.03]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-5 sm:px-8 lg:grid-cols-2 lg:gap-24">
        <div>
          <SectionHeading
            eyebrow="Our craft"
            title={
              <>
                Built with patience.
                <br />
                Finished with <span className="text-gold-gradient italic">pride.</span>
              </>
            }
          />

          <ul className="mt-12 space-y-8">
            {POINTS.map((point, index) => (
              <li key={point.title}>
                <Reveal delay={index * 0.1} from="left" y={24}>
                  <div className="flex gap-5">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-gold-500/30 bg-gold-500/10 text-gold-300">
                      <point.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="font-display text-2xl font-semibold text-white">{point.title}</h3>
                      <p className="mt-1.5 max-w-md leading-relaxed text-zinc-400">{point.text}</p>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>

          <dl className="mt-14 grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-8">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dd className="font-display text-5xl font-semibold text-gold-gradient">
                  <Counter to={stat.value} />
                </dd>
                <dt className="mt-1 text-xs uppercase tracking-[0.2em] text-zinc-500">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </div>

        <Reveal from="right" y={60}>
          <Visual />
        </Reveal>
      </div>

      <p className="mt-24 flex items-center justify-center gap-3 text-xs uppercase tracking-[0.3em] text-zinc-600">
        <Crown className="h-3.5 w-3.5 text-gold-500/60" /> Gorgeous Furniture
      </p>
    </section>
  );
}
