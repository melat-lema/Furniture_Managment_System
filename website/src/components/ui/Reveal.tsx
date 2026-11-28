import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

interface RevealProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  /** which way it slides in from */
  from?: 'bottom' | 'left' | 'right';
}

/** Fades and slides its content in the first time it scrolls into view. */
export default function Reveal({ children, delay = 0, y = 32, className, from = 'bottom' }: RevealProps) {
  const reduce = useReducedMotion();
  const offset = from === 'bottom' ? { y } : { x: from === 'left' ? -y : y };
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
