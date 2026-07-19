import React from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/shared/components';

export interface InsuranceData {
  insuranceProvider: string;
  insurancePolicyNumber: string;
}

export interface InsuranceSectionProps {
  data: InsuranceData;
  editing: boolean;
  errors: Record<string, string>;
  onChange: (field: keyof InsuranceData, value: string) => void;
}

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

/**
 * InsuranceSection — Displays/edits patient insurance information.
 * Fields: provider, policyNumber.
 * Validates: Requirements 1.1, 1.2
 */
export const InsuranceSection: React.FC<InsuranceSectionProps> = ({
  data,
  editing,
  errors,
  onChange,
}) => {
  return (
    <motion.div variants={sectionVariants} initial="hidden" animate="visible" transition={{ delay: 0.4 }}>
      <GlassCard className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          Seguro Médico
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Provider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Aseguradora
            </label>
            {editing ? (
              <>
                <input
                  type="text"
                  value={data.insuranceProvider}
                  onChange={(e) => onChange('insuranceProvider', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    errors.insuranceProvider
                      ? 'border-red-400 focus:ring-red-400'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-400'
                  } bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-colors`}
                  placeholder="Nombre de la aseguradora"
                />
                {errors.insuranceProvider && (
                  <p className="mt-1 text-xs text-red-500">{errors.insuranceProvider}</p>
                )}
              </>
            ) : (
              <p className="text-gray-900 dark:text-white">{data.insuranceProvider || '—'}</p>
            )}
          </div>

          {/* Policy Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Número de póliza
            </label>
            {editing ? (
              <>
                <input
                  type="text"
                  value={data.insurancePolicyNumber}
                  onChange={(e) => onChange('insurancePolicyNumber', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    errors.insurancePolicyNumber
                      ? 'border-red-400 focus:ring-red-400'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-400'
                  } bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-colors`}
                  placeholder="Número de póliza"
                />
                {errors.insurancePolicyNumber && (
                  <p className="mt-1 text-xs text-red-500">{errors.insurancePolicyNumber}</p>
                )}
              </>
            ) : (
              <p className="text-gray-900 dark:text-white">{data.insurancePolicyNumber || '—'}</p>
            )}
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
};
