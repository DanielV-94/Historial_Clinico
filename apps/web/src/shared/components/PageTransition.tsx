import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface PageTransitionProps {
  children: React.ReactNode;
  /** Animation duration in seconds (0.2 - 0.4). Default: 0.3 */
  duration?: number;
  /** Unique key to trigger transition (e.g., route path) */
  transitionKey?: string;
  /** Animation mode. Default: 'wait' */
  mode?: 'wait' | 'sync' | 'popLayout';
}

/**
 * PageTransition — Framer Motion wrapper with fade + slide animation (200-400ms).
 * Validates: Requirement 11.2
 */
export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  duration = 0.3,
  transitionKey,
  mode = 'wait',
}) => {
  // Clamp duration between 0.2 and 0.4 seconds
  const clampedDuration = Math.min(0.4, Math.max(0.2, duration));

  const variants = {
    initial: {
      opacity: 0,
      y: 8,
    },
    animate: {
      opacity: 1,
      y: 0,
    },
    exit: {
      opacity: 0,
      y: -8,
    },
  };

  return (
    <AnimatePresence mode={mode}>
      <motion.div
        key={transitionKey}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{
          duration: clampedDuration,
          ease: 'easeInOut',
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
