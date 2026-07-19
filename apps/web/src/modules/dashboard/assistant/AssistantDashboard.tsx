import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { PageTransition } from '@/shared/components';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import {
  AppointmentMaterialsList,
  AppointmentItem,
} from './AppointmentMaterialsList';
import {
  PrescriptionInbox,
  PrescriptionItem,
} from './PrescriptionInbox';

/** Response shape from GET /dashboard/assistant/today */
interface AssistantTodayResponse {
  appointments: AppointmentItem[];
}

/** Response shape from GET /prescriptions/inbox */
interface PrescriptionInboxResponse {
  data: PrescriptionItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * AssistantDashboard — Main dashboard view for the assistant role.
 * Shows today's appointments with materials and the prescription inbox.
 *
 * @validates Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */
export function AssistantDashboard() {
  const user = useAuthStore((state) => state.user);

  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    setLoadingAppointments(true);
    try {
      const response = await api.get<AssistantTodayResponse>(
        '/dashboard/assistant/today'
      );
      setAppointments(response.appointments);
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setError('Error al cargar las citas del día');
    } finally {
      setLoadingAppointments(false);
    }
  }, []);

  const fetchPrescriptions = useCallback(async () => {
    setLoadingPrescriptions(true);
    try {
      const response = await api.get<PrescriptionInboxResponse>(
        '/prescriptions/inbox'
      );
      setPrescriptions(response.data);
    } catch (err) {
      console.error('Error fetching prescriptions:', err);
      setError('Error al cargar la bandeja de prescripciones');
    } finally {
      setLoadingPrescriptions(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
    fetchPrescriptions();
  }, [fetchAppointments, fetchPrescriptions]);

  const handlePrescriptionCompleted = (id: string) => {
    // Remove from the active list (archived)
    setPrescriptions((prev) => prev.filter((p) => p.id !== id));
  };

  const handlePrescriptionPrinted = (_id: string) => {
    // Mark as read locally if not already
    setPrescriptions((prev) =>
      prev.map((p) =>
        p.id === _id && !p.readAt
          ? { ...p, readAt: new Date().toISOString(), status: 'read' }
          : p
      )
    );
  };

  return (
    <PageTransition transitionKey="assistant-dashboard">
      <div className="space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Dashboard del Asistente
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {user?.fullName && `Hola, ${user.fullName}. `}
            {new Date().toLocaleDateString('es-MX', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </motion.div>

        {/* Error banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-3"
          >
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </motion.div>
        )}

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Appointments with Materials */}
          <section aria-label="Citas del día">
            <AppointmentMaterialsList
              appointments={appointments}
              isLoading={loadingAppointments}
              clinicName="Clínica"
            />
          </section>

          {/* Right Column: Prescription Inbox */}
          <section aria-label="Bandeja de prescripciones">
            <PrescriptionInbox
              prescriptions={prescriptions}
              isLoading={loadingPrescriptions}
              onMarkCompleted={handlePrescriptionCompleted}
              onPrintPdf={handlePrescriptionPrinted}
            />
          </section>
        </div>
      </div>
    </PageTransition>
  );
}
