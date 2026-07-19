import React, { useState, useEffect } from 'react';

export interface SkeletonLoaderProps {
  /** Width of the skeleton (CSS value). Default: '100%' */
  width?: string;
  /** Height of the skeleton (CSS value). Default: '1rem' */
  height?: string;
  /** Whether to use rounded corners. Default: false */
  rounded?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Delay before showing skeleton (ms). Default: 300 */
  delay?: number;
}

/**
 * SkeletonLoader — Animated placeholder shown after a 300ms delay to avoid flash.
 * Validates: Requirement 11.2
 */
export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = '1rem',
  rounded = false,
  className = '',
  delay = 300,
}) => {
  const [visible, setVisible] = useState(delay === 0);

  useEffect(() => {
    if (delay === 0) return;

    const timer = setTimeout(() => {
      setVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  if (!visible) return null;

  const classes = [
    'animate-pulse bg-gray-200 dark:bg-gray-700',
    rounded ? 'rounded-full' : 'rounded',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      style={{ width, height }}
      role="status"
      aria-label="Cargando contenido"
      aria-busy="true"
    >
      <span className="sr-only">Cargando...</span>
    </div>
  );
};
