import React from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/shared/components';

export interface EmergencyContactData {
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
}

export interface EmergencyContactSectionProps {
  data: EmergencyContactData;
  editing: boolean;
  errors: Record<string, string>;
  onChange: (field: keyof EmergencyContactData, value: string) => void;
}

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

/**
 * EmergencyContactSection — Displays/edits emergency contact information.
 * Fields: name, phone, relation.
 * Validates: Requirements 1.1, 1.2
 */
export const EmergencyContactSection: React.FC<EmergencyContactSectionProps> = ({
  data,
  editing,
  errors,
  onChange,
}) => {
  return (
    <motion.div variants={sectionVariants} initial="hidden" animate="visible" transition={{ delay: 0.3 }}>
      <GlassCard className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
          Contacto de Emergencia
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nombre
            </label>
            {editing ? (
              <>
                <input
                  type="text"
                  value={data.emergencyContactName}
                  onChange={(e) => onChange('emergencyContactName', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    errors.emergencyContactName
                      ? 'border-red-400 focus:ring-red-400'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-400'
                  } bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-colors`}
                  placeholder="Nombre del contacto"
                />
                {errors.emergencyContactName && (
                  <p className="mt-1 text-xs text-red-500">{errors.emergencyContactName}</p>
                )}
              </>
            ) : (
              <p className="text-gray-900 dark:text-white">{data.emergencyContactName || '—'}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Teléfono
            </label>
            {editing ? (
              <>
                <input
                  type="tel"
                  value={data.emergencyContactPhone}
                  onChange={(e) => onChange('emergencyContactPhone', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    errors.emergencyContactPhone
                      ? 'border-red-400 focus:ring-red-400'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-400'
                  } bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-colors`}
                  placeholder="Teléfono de emergencia"
                />
                {errors.emergencyContactPhone && (
                  <p className="mt-1 text-xs text-red-500">{errors.emergencyContactPhone}</p>
                )}
              </>
            ) : (
              <p className="text-gray-900 dark:text-white">{data.emergencyContactPhone || '—'}</p>
            )}
          </div>

          {/* Relation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Parentesco
            </label>
            {editing ? (
              <input
                type="text"
                value={data.emergencyContactRelation}
                onChange={(e) => onChange('emergencyContactRelation', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors"
                placeholder="Ej: Esposo/a, Padre, Madre"
              />
            ) : (
              <p className="text-gray-900 dark:text-white">{data.emergencyContactRelation || '—'}</p>
            )}
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
};
