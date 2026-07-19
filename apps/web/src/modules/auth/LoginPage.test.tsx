import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { useAuthStore } from '@/stores/authStore';

// Mock the api module
vi.mock('@/services/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { api } from '@/services/api';

function renderLoginPage(initialEntries = ['/login'], state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
      <LoginPage />
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
  });

  it('renders login form with username and password fields', () => {
    renderLoginPage();
    expect(screen.getByLabelText('Usuario')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar Sesión' })).toBeInTheDocument();
  });

  it('shows error when username is empty on submit', async () => {
    renderLoginPage();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));
    expect(await screen.findByText('El nombre de usuario es obligatorio')).toBeInTheDocument();
  });

  it('shows error when password is empty on submit', async () => {
    renderLoginPage();
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'doctor1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));
    expect(await screen.findByText('La contraseña es obligatoria')).toBeInTheDocument();
  });

  it('calls api.post on valid submission', async () => {
    const mockResponse = {
      accessToken: 'test-token',
      user: { id: '1', username: 'doctor1', role: 'doctor', fullName: 'Dr. Test' },
    };
    vi.mocked(api.post).mockResolvedValueOnce(mockResponse);

    renderLoginPage();
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'doctor1' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Password1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/auth/login',
        { username: 'doctor1', password: 'Password1' },
        { skipAuth: true }
      );
    });
  });

  it('stores user and token on successful login', async () => {
    const mockResponse = {
      accessToken: 'jwt-token-123',
      user: { id: '1', username: 'doctor1', role: 'doctor', fullName: 'Dr. Test' },
    };
    vi.mocked(api.post).mockResolvedValueOnce(mockResponse);

    renderLoginPage();
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'doctor1' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Password1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));

    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toBe('jwt-token-123');
      expect(state.user?.username).toBe('doctor1');
    });
  });

  it('shows "Credenciales incorrectas" on 401 error', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ status: 401, message: 'Unauthorized' });

    renderLoginPage();
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'doctor1' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));

    expect(await screen.findByText('Credenciales incorrectas')).toBeInTheDocument();
  });

  it('shows account locked message with remaining time on 423 error', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({
      status: 423,
      message: 'Cuenta bloqueada',
      data: { remainingMinutes: 12 },
    });

    renderLoginPage();
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'doctor1' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));

    expect(await screen.findByText('Cuenta bloqueada. Intente de nuevo en 12 minutos')).toBeInTheDocument();
  });

  it('toggles password visibility', () => {
    renderLoginPage();
    const passwordInput = screen.getByLabelText('Contraseña');
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleBtn = screen.getByLabelText('Mostrar contraseña');
    fireEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute('type', 'text');

    const hideBtn = screen.getByLabelText('Ocultar contraseña');
    fireEvent.click(hideBtn);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('shows session expired message from router state', () => {
    renderLoginPage(['/login'], { message: 'Su sesión expiró por inactividad' });
    expect(screen.getByText('Su sesión expiró por inactividad')).toBeInTheDocument();
  });

  it('disables form during loading state', async () => {
    // Make the API call hang
    vi.mocked(api.post).mockImplementation(() => new Promise(() => {}));

    renderLoginPage();
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'doctor1' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Password1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));

    await waitFor(() => {
      expect(screen.getByText('Iniciando sesión...')).toBeInTheDocument();
      expect(screen.getByLabelText('Usuario')).toBeDisabled();
      expect(screen.getByLabelText('Contraseña')).toBeDisabled();
    });
  });
});
