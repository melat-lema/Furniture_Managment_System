import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { lazy, Suspense, useRef, useState } from 'react';
import { LinkButton } from '../components/ui/Button';
import Crown from '../components/ui/Crown';
import { useSite } from '../hooks/useSite';

// the 3D scene (and the whole three.js library) loads after the page is already visible
const HeroScene = lazy(() => import('../components/HeroScene'));

const LINES = ['Where every home', 'finds its throne.'];

export default function Hero() {
  const reduce = useReducedMotion();
  const { data } = useSite();
  const ref = useRef<HTMLElement>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);

  // the words drift up and fade as you scroll past
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const textY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 120]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <section id="top" ref={ref} className="grain relative isolate min-h-svh overflow-hidden bg-ink-950">
      {/* warm light and vignette behind the 3D scene */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-[radial-gradient(60%_70%_at_75%_55%,rgb(201_154_46/0.22),transparent_70%),radial-gradient(40%_50%_at_10%_0%,rgb(226_176_74/0.08),transparent_70%)]"
      />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-linear-to-t from-ink-950 to-transparent" />

      {/* the 3D armchair */}
      {!sceneFailed && (
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: sceneReady ? 1 : 0 }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
        >
          <Suspense fallback={null}>
            <HeroScene onReady={() => setSceneReady(true)} onFail={() => setSceneFailed(true)} />
          </Suspense>
        </motion.div>
      )}

      {/* if 3D is not available, the crown still makes the page feel finished */}
      {sceneFailed && (
        <div aria-hidden="true" className="absolute inset-0 -z-10 flex items-center justify-end pr-[12%]">
          <img src="/gf-mark.png" alt="" className="h-[48vh] w-auto animate-float opacity-70" />
        </div>
      )}

      <motion.div style={{ y: textY, opacity: textOpacity }} className="relative mx-auto flex min-h-svh max-w-7xl flex-col justify-center px-5 pb-24 pt-32 sm:px-8 lg:pt-24">
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-gold-400"
        >
          <Crown className="h-4 w-4" />
          Gorgeous Furniture · Addis Ababa
        </motion.p>

        <h1 className="mt-6 max-w-3xl font-display text-[clamp(3rem,8.6vw,7.4rem)] font-semibold leading-[0.95] text-white">
          {LINES.map((line, index) => (
            <span key={line} className="block overflow-hidden pb-[0.08em]">
              <motion.span
                className="block"
                initial={reduce ? false : { y: '110%' }}
                animate={{ y: 0 }}
                transition={{ delay: 0.45 + index * 0.18, duration: 1, ease: [0.22, 1, 0.36, 1] }}
              >
                {index === 1 ? (
                  <>
                    finds its <span className="text-gold-gradient italic">throne.</span>
                  </>
                ) : (
                  line
                )}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.9 }}
          className="mt-7 max-w-lg text-base leading-relaxed text-zinc-300 sm:text-lg"
        >
          Furniture built by hand in our own workshop, finished with gold details, and waiting for you in our showrooms.
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.15, duration: 0.9 }}
          className="mt-10 flex flex-wrap items-center gap-4"
        >
          <LinkButton href="#collections" icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
            Explore the collections
          </LinkButton>
          <LinkButton href="#showrooms" variant="ghost">
            Find a showroom
          </LinkButton>
        </motion.div>

        {/* real numbers from the system */}
        <motion.dl
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="mt-14 flex flex-wrap gap-x-12 gap-y-4"
        >
          {[
            { value: '1', label: 'own workshop' },
            { value: String(data.stats.showrooms), label: data.stats.showrooms === 1 ? 'showroom' : 'showrooms' },
            { value: String(data.stats.products), label: 'pieces to explore' },
          ].map((stat) => (
            <div key={stat.label}>
              <dt className="sr-only">{stat.label}</dt>
              <dd className="flex items-baseline gap-2">
                <span className="font-display text-4xl font-semibold text-white">{stat.value}</span>
                <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">{stat.label}</span>
              </dd>
            </div>
          ))}
        </motion.dl>
      </motion.div>

      <a href="#craft" aria-label="Scroll down" className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-zinc-500 transition hover:text-gold-300 sm:flex">
        Scroll
        <motion.span animate={reduce ? undefined : { y: [0, 8, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}>
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </motion.span>
      </a>
    </section>
  );
}
