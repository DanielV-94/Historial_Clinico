import React from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/shared/components';

export interface NextPatient {
  id: string;
  name: string;
  photoUrl?: string;
  lastProcedure?: {
    name: string;
    date: string;
  };
  currentReason: string;
  allergies: string[];
}

export interface NextPatientCardProps {
  patient: NextPatient | null;
  loading?: boolean;
  /** Whether all appointments are completed */
  allCompleted?: boolean;
}

/**
 * NextPatientCard — Displays next patient info: photo, name, last procedure, allergies.
 * Hidden when there are no appointments or all are completed.
 * Validates: Requirements 5.2, 5.4, 5.5
 */
export const NextPatientCard: React.FC<NextPatientCardProps> = ({
  patient,
  loading = false,
  allCompleted = false,
}) => {
  // Hidden when no patient or all completed
  if (allCompleted || (!loading && !patient)) {
    return null;
  }

  if (loading) {
    return (
      <GlassCard className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Próximo Paciente
        </h2>
        <div className="flex items-start gap-4">
          <div className="animate-pulse w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="animate-pulse h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="animate-pulse h-4 w-56 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="animate-pulse h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </GlassCard>
    );
  }

  if (!patient) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <GlassCard className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Próximo Paciente
        </h2>

        <div className="flex items-start gap-4">
          {/* Patient Photo */}
          <div className="flex-shrink-0">
            {patient.photoUrl ? (
              <img
                src={patient.photoUrl}
                alt={`Foto de ${patient.name}`}
                className="w-16 h-16 rounded-full object-cover ring-2 ring-white/50 dark:ring-gray-600/50 shadow-md"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xl font-bold shadow-md"
                aria-label={`Iniciales de ${patient.name}`}
              >
                {patient.name
                  .split(' ')
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()}
              </div>
            )}
          </div>

          {/* Patient Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
              {patient.name}
            </h3>

            {/* Current appointment reason */}
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
              <span className="font-medium">Motivo:</span> {patient.currentReason}
            </p>

            {/* Last procedure */}
            {patient.lastProcedure && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                <span className="font-medium">Último procedimiento:</span>{' '}
                {patient.lastProcedure.name}
                <span className="text-xs ml-1 text-gray-400 dark:text-gray-500">
                  ({patient.lastProcedure.date})
                </span>
              </p>
            )}

            {/* Allergies */}
            {patient.allergies.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-1">
                  Alergias
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {patient.allergies.map((allergy, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                    >
                      {allergy}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
};
