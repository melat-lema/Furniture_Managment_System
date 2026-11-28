import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { useEffect, useRef } from 'react';

/** A number that counts up the first time it is seen. */
export default function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const reduce = useReducedMotion();
  const value = useMotionValue(0);
  const text = useTransform(value, (latest) => `${Math.round(latest)}${suffix}`);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(value, to, { duration: reduce ? 0 : 1.8, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [inView, to, value, reduce]);

  return <motion.span ref={ref}>{text}</motion.span>;
}
