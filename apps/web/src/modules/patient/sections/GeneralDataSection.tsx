import React from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/shared/components';

export interface GeneralData {
  fullName: string;
  birthDate: string;
  sex: string;
  phone: string;
  email: string;
  address: string;
  bloodType: string;
  profilePhotoPath?: string | null;
}

export interface GeneralDataSectionProps {
  data: GeneralData;
  editing: boolean;
  errors: Record<string, string>;
  onChange: (field: keyof GeneralData, value: string) => void;
}

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

/**
 * GeneralDataSection — Displays/edits general patient data.
 * Fields: fullName, birthDate, sex, phone, email, address, bloodType, profilePhoto.
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */
export const GeneralDataSection: React.FC<GeneralDataSectionProps> = ({
  data,
  editing,
  errors,
  onChange,
}) => {
  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const sexOptions = [
    { value: 'M', label: 'Masculino' },
    { value: 'F', label: 'Femenino' },
    { value: 'O', label: 'Otro' },
  ];

  return (
    <motion.div variants={sectionVariants} initial="hidden" animate="visible" transition={{ delay: 0.1 }}>
      <GlassCard className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
          Datos Generales
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Full Name */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nombre completo <span className="text-red-500">*</span>
            </label>
            {editing ? (
              <>
                <input
                  type="text"
                  value={data.fullName}
                  onChange={(e) => onChange('fullName', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    errors.fullName
                      ? 'border-red-400 focus:ring-red-400'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-400'
                  } bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-colors`}
                  placeholder="Nombre completo del paciente"
                />
                {errors.fullName && (
                  <p className="mt-1 text-xs text-red-500">{errors.fullName}</p>
                )}
              </>
            ) : (
              <p className="text-gray-900 dark:text-white">{data.fullName || '—'}</p>
            )}
          </div>

          {/* Birth Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fecha de nacimiento <span className="text-red-500">*</span>
            </label>
            {editing ? (
              <>
                <input
                  type="date"
                  value={data.birthDate}
                  onChange={(e) => onChange('birthDate', e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    errors.birthDate
                      ? 'border-red-400 focus:ring-red-400'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-400'
                  } bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-colors`}
                />
                {errors.birthDate && (
                  <p className="mt-1 text-xs text-red-500">{errors.birthDate}</p>
                )}
              </>
            ) : (
              <p className="text-gray-900 dark:text-white">
                {data.birthDate
                  ? new Date(data.birthDate + 'T00:00:00').toLocaleDateString('es-MX', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : '—'}
              </p>
            )}
          </div>

          {/* Sex */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sexo <span className="text-red-500">*</span>
            </label>
            {editing ? (
              <>
                <select
                  value={data.sex}
                  onChange={(e) => onChange('sex', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    errors.sex
                      ? 'border-red-400 focus:ring-red-400'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-400'
                  } bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-colors`}
                >
                  <option value="">Seleccionar...</option>
                  {sexOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {errors.sex && (
                  <p className="mt-1 text-xs text-red-500">{errors.sex}</p>
                )}
              </>
            ) : (
              <p className="text-gray-900 dark:text-white">
                {sexOptions.find((o) => o.value === data.sex)?.label || '—'}
              </p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Teléfono <span className="text-red-500">*</span>
            </label>
            {editing ? (
              <>
                <input
                  type="tel"
                  value={data.phone}
                  onChange={(e) => onChange('phone', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    errors.phone
                      ? 'border-red-400 focus:ring-red-400'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-400'
                  } bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-colors`}
                  placeholder="10 dígitos mínimo"
                />
                {errors.phone && (
                  <p className="mt-1 text-xs text-red-500">{errors.phone}</p>
                )}
              </>
            ) : (
              <p className="text-gray-900 dark:text-white">{data.phone || '—'}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Correo electrónico
            </label>
            {editing ? (
              <>
                <input
                  type="email"
                  value={data.email}
                  onChange={(e) => onChange('email', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    errors.email
                      ? 'border-red-400 focus:ring-red-400'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-400'
                  } bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-colors`}
                  placeholder="correo@ejemplo.com"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-500">{errors.email}</p>
                )}
              </>
            ) : (
              <p className="text-gray-900 dark:text-white">{data.email || '—'}</p>
            )}
          </div>

          {/* Address */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Dirección
            </label>
            {editing ? (
              <input
                type="text"
                value={data.address}
                onChange={(e) => onChange('address', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors"
                placeholder="Dirección del paciente"
              />
            ) : (
              <p className="text-gray-900 dark:text-white">{data.address || '—'}</p>
            )}
          </div>

          {/* Blood Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tipo de sangre
            </label>
            {editing ? (
              <select
                value={data.bloodType}
                onChange={(e) => onChange('bloodType', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors"
              >
                <option value="">Seleccionar...</option>
                {bloodTypes.map((bt) => (
                  <option key={bt} value={bt}>
                    {bt}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-gray-900 dark:text-white">{data.bloodType || '—'}</p>
            )}
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
};
