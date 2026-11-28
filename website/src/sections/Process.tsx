import { motion, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import { Hammer, ShieldCheck, Sofa, Store } from 'lucide-react';
import { useRef } from 'react';
import Reveal from '../components/ui/Reveal';
import SectionHeading from '../components/ui/SectionHeading';

const STEPS = [
  { icon: Hammer, title: 'Crafted in our workshop', text: 'Our craftsmen cut, frame and upholster every piece by hand, from the first plank to the last gold detail.' },
  { icon: ShieldCheck, title: 'Checked and stored', text: 'The finished piece is inspected and kept safe in our store until it is ready for its showroom.' },
  { icon: Store, title: 'Shown in our showrooms', text: 'Visit a showroom, sit in the pieces, feel the fabric and talk to our team about what suits your home.' },
  { icon: Sofa, title: 'Yours to take home', text: 'Choose your piece, pay with the method that suits you, and bring it into the room it was meant for.' },
];

export default function Process() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  // the gold line draws itself as you scroll down the steps
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 65%', 'end 55%'] });
  const line = useSpring(scrollYProgress, { stiffness: 120, damping: 28 });

  return (
    <section id="process" className="relative bg-ink-950 py-28 sm:py-36">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <SectionHeading
          align="center"
          eyebrow="The journey"
          title={
            <>
              From our workshop to <span className="text-gold-gradient italic">your home.</span>
            </>
          }
        />

        <div ref={ref} className="relative mt-20">
          {/* the track and the gold line that fills it */}
          <div aria-hidden="true" className="absolute bottom-6 left-[1.65rem] top-6 w-px bg-white/10 md:left-1/2 md:-translate-x-1/2" />
          <motion.div
            aria-hidden="true"
            style={{ scaleY: reduce ? 1 : line }}
            className="absolute bottom-6 left-[1.65rem] top-6 w-px origin-top bg-linear-to-b from-gold-300 via-gold-400 to-gold-600 md:left-1/2 md:-translate-x-1/2"
          />

          <ol className="space-y-16 md:space-y-24">
            {STEPS.map((step, index) => {
              const right = index % 2 === 1;
              return (
                <li key={step.title} className="relative grid items-center md:grid-cols-2 md:gap-24">
                  <span className="absolute left-0 top-1 z-10 flex h-[3.3rem] w-[3.3rem] items-center justify-center rounded-full border border-gold-500/40 bg-ink-950 text-gold-300 shadow-[0_0_40px_-8px_rgb(226_176_74/0.6)] md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2">
                    <step.icon className="h-5 w-5" aria-hidden="true" />
                  </span>

                  <div className={`pl-20 md:pl-0 ${right ? 'md:col-start-2' : 'md:col-start-1 md:text-right'}`}>
                    <Reveal from={right ? 'right' : 'left'} y={40}>
                      <p className="font-display text-6xl font-semibold text-white/10">0{index + 1}</p>
                      <h3 className="-mt-3 font-display text-3xl font-semibold text-white sm:text-4xl">{step.title}</h3>
                      <p className={`mt-3 max-w-md leading-relaxed text-zinc-400 ${right ? '' : 'md:ml-auto'}`}>{step.text}</p>
                    </Reveal>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
