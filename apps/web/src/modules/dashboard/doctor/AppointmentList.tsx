import React from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/shared/components';

export interface Appointment {
  id: string;
  time: string;
  patientName: string;
  reason: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface AppointmentListProps {
  appointments: Appointment[];
  loading?: boolean;
}

/**
 * AppointmentList — Displays today's appointments ordered ascending by time.
 * Shows hour, patient name, and reason. Handles empty state and all-completed state.
 * Validates: Requirements 5.1, 5.4, 5.5
 */
export const AppointmentList: React.FC<AppointmentListProps> = ({
  appointments,
  loading = false,
}) => {
  const allCompleted =
    appointments.length > 0 &&
    appointments.every((apt) => apt.status === 'completed');

  if (loading) {
    return (
      <GlassCard className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Citas del Día
        </h2>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"
            />
          ))}
        </div>
      </GlassCard>
    );
  }

  // Empty state: no appointments
  if (appointments.length === 0) {
    return (
      <GlassCard className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Citas del Día
        </h2>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <svg
            className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-gray-500 dark:text-gray-400 text-base">
            No hay consultas programadas para hoy
          </p>
        </div>
      </GlassCard>
    );
  }

  // All completed state
  if (allCompleted) {
    return (
      <GlassCard className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Citas del Día
        </h2>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <svg
            className="h-16 w-16 text-green-400 dark:text-green-500 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-green-600 dark:text-green-400 text-base font-medium">
            Todas las consultas fueron atendidas
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            {appointments.length} cita{appointments.length > 1 ? 's' : ''} completada{appointments.length > 1 ? 's' : ''}
          </p>
        </div>
      </GlassCard>
    );
  }

  // Normal state: list appointments ordered ascending by time
  const sorted = [...appointments].sort(
    (a, b) => a.time.localeCompare(b.time)
  );

  return (
    <GlassCard className="p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Citas del Día
      </h2>
      <ul className="space-y-2" role="list" aria-label="Lista de citas del día">
        {sorted.map((apt, index) => (
          <motion.li
            key={apt.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            className={`flex items-center gap-4 p-3 rounded-xl transition-colors ${
              apt.status === 'completed'
                ? 'bg-green-50/50 dark:bg-green-900/10 opacity-60'
                : apt.status === 'in_progress'
                ? 'bg-primary-50/50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-700'
                : 'bg-white/30 dark:bg-gray-800/30 hover:bg-white/50 dark:hover:bg-gray-800/50'
            }`}
          >
            {/* Time */}
            <div className="flex-shrink-0 w-16 text-center">
              <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                {apt.time}
              </span>
            </div>

            {/* Separator dot */}
            <div
              className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${
                apt.status === 'completed'
                  ? 'bg-green-400'
                  : apt.status === 'in_progress'
                  ? 'bg-primary-500 animate-pulse'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
              aria-hidden="true"
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {apt.patientName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {apt.reason}
              </p>
            </div>

            {/* Status badge */}
            {apt.status === 'completed' && (
              <span className="flex-shrink-0 text-xs text-green-600 dark:text-green-400 font-medium">
                Atendido
              </span>
            )}
            {apt.status === 'in_progress' && (
              <span className="flex-shrink-0 text-xs text-primary-600 dark:text-primary-400 font-medium">
                En consulta
              </span>
            )}
          </motion.li>
        ))}
      </ul>
    </GlassCard>
  );
};
