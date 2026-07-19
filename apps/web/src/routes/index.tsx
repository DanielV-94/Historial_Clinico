import { createBrowserRouter, Navigate } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { KioskLayout } from '@/layouts/KioskLayout';
import { LoginPage } from '@/modules/auth/LoginPage';
import { AuthGuard } from '@/modules/auth/AuthGuard';
import { DoctorDashboard } from '@/modules/dashboard/doctor';
import { AssistantDashboard } from '@/modules/dashboard/assistant';
import { PatientProfile } from '@/modules/patient';
import { KioskWizard } from '@/modules/kiosk';
import { useAuthStore } from '@/stores/authStore';
import { RoleGuard } from '@/routes/RoleGuard';

/**
 * DashboardRedirect — Renders the correct dashboard based on user role.
 * - assistant → AssistantDashboard
 * - doctor/admin → DoctorDashboard
 */
function DashboardPage() {
  const role = useAuthStore((state) => state.user?.role);

  if (role === 'assistant') {
    return <AssistantDashboard />;
  }

  return <DoctorDashboard />;
}

function PatientsPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        Pacientes
      </h2>
    </div>
  );
}

function PrescriptionsPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        Prescripciones
      </h2>
    </div>
  );
}

function SettingsPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        Configuración
      </h2>
    </div>
  );
}

function KioskRegisterPage() {
  return <KioskWizard />;
}

function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
        404
      </h2>
      <p className="text-gray-600 dark:text-gray-400">
        Página no encontrada
      </p>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    // Auth routes (login) - public, no guard
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
    ],
  },
  {
    // Main app routes (authenticated) - protected by AuthGuard
    element: <AuthGuard />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          {
            path: '/dashboard',
            element: (
              <RoleGuard allowed={['doctor', 'assistant', 'admin']}>
                <DashboardPage />
              </RoleGuard>
            ),
          },
          {
            path: '/patients',
            element: (
              <RoleGuard allowed={['doctor', 'assistant', 'admin']}>
                <PatientsPage />
              </RoleGuard>
            ),
          },
          {
            path: '/patients/new',
            element: (
              <RoleGuard allowed={['doctor', 'admin']}>
                <PatientProfile />
              </RoleGuard>
            ),
          },
          {
            path: '/patients/:id',
            element: (
              <RoleGuard allowed={['doctor', 'assistant', 'admin']}>
                <PatientProfile />
              </RoleGuard>
            ),
          },
          {
            path: '/prescriptions',
            element: (
              <RoleGuard allowed={['assistant', 'admin']}>
                <PrescriptionsPage />
              </RoleGuard>
            ),
          },
          {
            path: '/settings',
            element: (
              <RoleGuard allowed={['admin']}>
                <SettingsPage />
              </RoleGuard>
            ),
          },
        ],
      },
    ],
  },
  {
    // Kiosk routes (full-screen, iPad-optimized)
    element: <KioskLayout />,
    children: [
      { path: '/kiosk', element: <KioskRegisterPage /> },
      { path: '/kiosk/register', element: <KioskRegisterPage /> },
    ],
  },
  {
    // Catch-all 404
    path: '*',
    element: <NotFoundPage />,
  },
]);
