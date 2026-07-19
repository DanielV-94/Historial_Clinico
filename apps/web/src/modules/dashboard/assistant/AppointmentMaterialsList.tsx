import React from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/shared/components';
import { WhatsAppButton } from './WhatsAppButton';

export interface AppointmentMaterial {
  id: string;
  materialName: string;
  quantity: number;
  notes: string | null;
}

export interface AppointmentItem {
  id: string;
  appointmentTime: string;
  reason: string;
  status: string;
  patient: {
    id: string;
    fullName: string;
    phone?: string;
  };
  materials: AppointmentMaterial[];
}

export interface AppointmentMaterialsListProps {
  appointments: AppointmentItem[];
  clinicName?: string;
  isLoading?: boolean;
}

/**
 * AppointmentMaterialsList — Displays today's appointments with
 * materials/supplies needed for each consultation.
 * Ordered by time ascending, includes WhatsApp reminder button.
 *
 * @validates Requirements 6.1, 6.2
 */
export const AppointmentMaterialsList: React.FC<AppointmentMaterialsListProps> = ({
  appointments,
  clinicName = 'Clínica',
  isLoading = false,
}) => {
  if (isLoading) {
    return <AppointmentsSkeleton />;
  }

  if (appointments.length === 0) {
    return (
      <GlassCard className="p-6">
        <div className="text-center py-8">
          <span className="text-4xl mb-3 block">📅</span>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
            Sin citas programadas
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            No hay consultas agendadas para hoy
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <span>📅</span>
        Citas del Día ({appointments.length})
      </h2>

      <div className="space-y-3">
        {appointments.map((appointment, index) => (
          <motion.div
            key={appointment.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
          >
            <GlassCard className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                {/* Left: Time + Patient info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-mono font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded">
                      {formatTime(appointment.appointmentTime)}
                    </span>
                    <StatusBadge status={appointment.status} />
                  </div>

                  <h3 className="font-medium text-gray-900 dark:text-white truncate">
                    {appointment.patient.fullName}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                    {appointment.reason}
                  </p>

                  {/* Materials */}
                  {appointment.materials.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                        Materiales / Insumos
                      </p>
                      <ul className="space-y-1">
                        {appointment.materials.map((material) => (
                          <li
                            key={material.id}
                            className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                            <span className="flex-1">
                              {material.materialName}
                              {material.quantity > 1 && (
                                <span className="text-gray-500 dark:text-gray-400 ml-1">
                                  (×{material.quantity})
                                </span>
                              )}
                            </span>
                            {material.notes && (
                              <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                                {material.notes}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {appointment.materials.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 italic">
                      Sin materiales asignados
                    </p>
                  )}
                </div>

                {/* Right: WhatsApp Button */}
                {appointment.patient.phone && (
                  <div className="flex-shrink-0">
                    <WhatsAppButton
                      phone={appointment.patient.phone}
                      patientName={appointment.patient.fullName}
                      appointmentDate={formatDate(appointment.appointmentTime)}
                      appointmentTime={formatTime(appointment.appointmentTime)}
                      clinicName={clinicName}
                    />
                  </div>
                )}
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    scheduled: {
      label: 'Programada',
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    },
    in_progress: {
      label: 'En curso',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    },
    completed: {
      label: 'Completada',
      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    },
    cancelled: {
      label: 'Cancelada',
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    },
  };

  const config = statusConfig[status] || {
    label: status,
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '--:--';
  }
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function AppointmentsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      {[1, 2, 3].map((i) => (
        <GlassCard key={i} className="p-4">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
            </div>
            <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
