import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { OfflineBanner } from './OfflineBanner';
import { useOfflineStore } from '@/stores/offlineStore';

describe('OfflineBanner', () => {
  beforeEach(() => {
    // Reset store state
    useOfflineStore.setState({ isOnline: true });
  });

  it('does not render when online', () => {
    useOfflineStore.setState({ isOnline: true });
    render(<OfflineBanner />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders offline message when offline', () => {
    useOfflineStore.setState({ isOnline: false });
    render(<OfflineBanner />);
    const banner = screen.getByRole('alert');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('Sin conexión');
  });

  it('mentions read-only mode and write unavailability', () => {
    useOfflineStore.setState({ isOnline: false });
    render(<OfflineBanner />);
    expect(screen.getByRole('alert')).toHaveTextContent('solo lectura');
    expect(screen.getByRole('alert')).toHaveTextContent('escritura no están disponibles');
  });

  it('has aria-live assertive for screen readers', () => {
    useOfflineStore.setState({ isOnline: false });
    render(<OfflineBanner />);
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });
});
