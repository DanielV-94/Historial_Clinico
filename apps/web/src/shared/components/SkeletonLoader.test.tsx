import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SkeletonLoader } from './SkeletonLoader';

describe('SkeletonLoader', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render immediately (300ms delay)', () => {
    render(<SkeletonLoader />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders after 300ms delay', () => {
    render(<SkeletonLoader />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders immediately when delay=0', () => {
    render(<SkeletonLoader delay={0} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('applies custom width and height', () => {
    render(<SkeletonLoader delay={0} width="200px" height="2rem" />);
    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveStyle({ width: '200px', height: '2rem' });
  });

  it('applies rounded-full when rounded=true', () => {
    render(<SkeletonLoader delay={0} rounded />);
    const skeleton = screen.getByRole('status');
    expect(skeleton.className).toContain('rounded-full');
  });

  it('has proper aria attributes for accessibility', () => {
    render(<SkeletonLoader delay={0} />);
    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
    expect(skeleton).toHaveAttribute('aria-label', 'Cargando contenido');
  });
});
