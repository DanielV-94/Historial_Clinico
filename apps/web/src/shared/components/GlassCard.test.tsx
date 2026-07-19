import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GlassCard } from './GlassCard';

describe('GlassCard', () => {
  it('renders children correctly', () => {
    render(<GlassCard>Hello World</GlassCard>);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('applies default glassmorphism background opacity', () => {
    render(<GlassCard>Content</GlassCard>);
    const card = screen.getByRole('region');
    // jsdom strips non-standard CSS like backdropFilter, so we test backgroundColor
    expect(card).toHaveStyle({ backgroundColor: 'rgba(255, 255, 255, 0.25)' });
  });

  it('applies custom opacity to background', () => {
    render(<GlassCard blur="20px" opacity={0.5}>Content</GlassCard>);
    const card = screen.getByRole('region');
    expect(card).toHaveStyle({ backgroundColor: 'rgba(255, 255, 255, 0.5)' });
  });

  it('applies custom className', () => {
    render(<GlassCard className="p-4">Content</GlassCard>);
    const card = screen.getByRole('region');
    expect(card.className).toContain('p-4');
  });

  it('omits border when border=false', () => {
    render(<GlassCard border={false}>Content</GlassCard>);
    const card = screen.getByRole('region');
    expect(card.className).not.toContain('border');
  });

  it('omits shadow when shadow=false', () => {
    render(<GlassCard shadow={false}>Content</GlassCard>);
    const card = screen.getByRole('region');
    expect(card.className).not.toContain('shadow-glass');
  });
});
