import React from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/shared/components';

export interface MedicalHistoryData {
  allergies: string[];
  previousSurgeries: Array<{ name: string; date: string }>;
}

export interface MedicalHistorySectionProps {
  data: MedicalHistoryData;
  editing: boolean;
  errors: Record<string, string>;
  onAddAllergy: () => void;
  onRemoveAllergy: (index: number) => void;
  onChangeAllergy: (index: number, value: string) => void;
  onAddSurgery: () => void;
  onRemoveSurgery: (index: number) => void;
  onChangeSurgery: (index: number, field: 'name' | 'date', value: string) => void;
}

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

/**
 * MedicalHistorySection — Displays/edits patient allergies and previous surgeries.
 * Limits: max 50 allergies (200 chars each), max 30 surgeries.
 * Validates: Requirements 1.1, 1.3
 */
export const MedicalHistorySection: React.FC<MedicalHistorySectionProps> = ({
  data,
  editing,
  errors,
  onAddAllergy,
  onRemoveAllergy,
  onChangeAllergy,
  onAddSurgery,
  onRemoveSurgery,
  onChangeSurgery,
}) => {
  return (
    <motion.div variants={sectionVariants} initial="hidden" animate="visible" transition={{ delay: 0.2 }}>
      <GlassCard className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
          Antecedentes Médicos
        </h2>

        {/* Allergies */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Alergias ({data.allergies.length}/50)
            </label>
            {editing && data.allergies.length < 50 && (
              <button
                type="button"
                onClick={onAddAllergy}
                className="text-xs px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
              >
                + Agregar alergia
              </button>
            )}
          </div>

          {errors.allergies && (
            <p className="mb-2 text-xs text-red-500">{errors.allergies}</p>
          )}

          {data.allergies.length === 0 && !editing && (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">Sin alergias registradas</p>
          )}

          <div className="space-y-2">
            {data.allergies.map((allergy, index) => (
              <div key={index} className="flex items-center gap-2">
                {editing ? (
                  <>
                    <input
                      type="text"
                      value={allergy}
                      onChange={(e) => onChangeAllergy(index, e.target.value)}
                      maxLength={200}
                      className={`flex-1 px-3 py-1.5 text-sm rounded-lg border ${
                        errors[`allergy_${index}`]
                          ? 'border-red-400'
                          : 'border-gray-300 dark:border-gray-600'
                      } bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors`}
                      placeholder="Descripción de la alergia"
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveAllergy(index)}
                      className="text-red-500 hover:text-red-700 text-sm px-2"
                      aria-label={`Eliminar alergia ${index + 1}`}
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                    {allergy}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Previous Surgeries */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Cirugías previas ({data.previousSurgeries.length}/30)
            </label>
            {editing && data.previousSurgeries.length < 30 && (
              <button
                type="button"
                onClick={onAddSurgery}
                className="text-xs px-2 py-1 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
              >
                + Agregar cirugía
              </button>
            )}
          </div>

          {errors.previousSurgeries && (
            <p className="mb-2 text-xs text-red-500">{errors.previousSurgeries}</p>
          )}

          {data.previousSurgeries.length === 0 && !editing && (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">Sin cirugías previas registradas</p>
          )}

          <div className="space-y-2">
            {data.previousSurgeries.map((surgery, index) => (
              <div key={index} className="flex items-center gap-2">
                {editing ? (
                  <>
                    <input
                      type="text"
                      value={surgery.name}
                      onChange={(e) => onChangeSurgery(index, 'name', e.target.value)}
                      className={`flex-1 px-3 py-1.5 text-sm rounded-lg border ${
                        errors[`surgery_name_${index}`]
                          ? 'border-red-400'
                          : 'border-gray-300 dark:border-gray-600'
                      } bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-400 transition-colors`}
                      placeholder="Nombre de la cirugía"
                    />
                    <input
                      type="date"
                      value={surgery.date}
                      onChange={(e) => onChangeSurgery(index, 'date', e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className={`w-40 px-3 py-1.5 text-sm rounded-lg border ${
                        errors[`surgery_date_${index}`]
                          ? 'border-red-400'
                          : 'border-gray-300 dark:border-gray-600'
                      } bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-400 transition-colors`}
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveSurgery(index)}
                      className="text-red-500 hover:text-red-700 text-sm px-2"
                      aria-label={`Eliminar cirugía ${index + 1}`}
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-900 dark:text-white">{surgery.name}</span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {surgery.date
                        ? new Date(surgery.date + 'T00:00:00').toLocaleDateString('es-MX', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : ''}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
};
