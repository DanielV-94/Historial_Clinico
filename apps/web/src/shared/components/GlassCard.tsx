import React from 'react';

export interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  /** Backdrop blur intensity (e.g., '8px', '12px'). Default: '12px' */
  blur?: string;
  /** Background opacity (0-1). Default: 0.25 */
  opacity?: number;
  /** Border radius class. Default: 'rounded-2xl' */
  rounded?: string;
  /** Whether to show border. Default: true */
  border?: boolean;
  /** Whether to show shadow. Default: true */
  shadow?: boolean;
}

/**
 * GlassCard — Container with configurable glassmorphism effect.
 * Uses white/gray palette with backdrop-blur and opacity.
 * Validates: Requirement 11.1
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  blur = '12px',
  opacity = 0.25,
  rounded = 'rounded-2xl',
  border = true,
  shadow = true,
}) => {
  const style: React.CSSProperties = {
    backdropFilter: `blur(${blur})`,
    WebkitBackdropFilter: `blur(${blur})`,
    backgroundColor: `rgba(255, 255, 255, ${opacity})`,
  };

  const classes = [
    rounded,
    border ? 'border border-white/20' : '',
    shadow ? 'shadow-glass' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} style={style} role="region">
      {children}
    </div>
  );
};
