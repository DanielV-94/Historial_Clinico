import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GeneralDataSection, GeneralData } from './sections/GeneralDataSection';
import { MedicalHistorySection, MedicalHistoryData } from './sections/MedicalHistorySection';
import { EmergencyContactSection, EmergencyContactData } from './sections/EmergencyContactSection';
import { InsuranceSection, InsuranceData } from './sections/InsuranceSection';
import { api } from '@/services/api';

export interface PatientFormData extends GeneralData, MedicalHistoryData, EmergencyContactData, InsuranceData {}

export interface PatientFormProps {
  /** Initial data for editing, or empty for creation */
  initialData?: Partial<PatientFormData>;
  /** Patient ID if editing */
  patientId?: string;
  /** Whether the form is in edit mode */
  editing: boolean;
  /** Callback after successful save */
  onSaved?: () => void;
  /** Callback to cancel editing */
  onCancel?: () => void;
  /** Toggle editing mode */
  onToggleEdit?: () => void;
}

interface DuplicateInfo {
  id: string;
  fullName: string;
  birthDate: string;
}

const emptyFormData: PatientFormData = {
  fullName: '',
  birthDate: '',
  sex: '',
  phone: '',
  email: '',
  address: '',
  bloodType: '',
  profilePhotoPath: null,
  allergies: [],
  previousSurgeries: [],
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelation: '',
  insuranceProvider: '',
  insurancePolicyNumber: '',
};

/**
 * PatientForm — Shared create/edit form for patient data.
 * Handles validation using @historial/validators, duplicate detection, and save confirmation.
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */
export const PatientForm: React.FC<PatientFormProps> = ({
  initialData,
  patientId,
  editing,
  onSaved,
  onCancel,
  onToggleEdit,
}) => {
  const [formData, setFormData] = useState<PatientFormData>({
    ...emptyFormData,
    ...initialData,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [duplicateAlert, setDuplicateAlert] = useState<DuplicateInfo | null>(null);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);

  const isCreating = !patientId;

  // General data change handler
  const handleGeneralChange = useCallback((field: keyof GeneralData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for field on change
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // Emergency contact change handler
  const handleEmergencyChange = useCallback((field: keyof EmergencyContactData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // Insurance change handler
  const handleInsuranceChange = useCallback((field: keyof InsuranceData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // Allergy handlers
  const handleAddAllergy = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      allergies: [...prev.allergies, ''],
    }));
  }, []);

  const handleRemoveAllergy = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      allergies: prev.allergies.filter((_, i) => i !== index),
    }));
  }, []);

  const handleChangeAllergy = useCallback((index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      allergies: prev.allergies.map((a, i) => (i === index ? value : a)),
    }));
  }, []);

  // Surgery handlers
  const handleAddSurgery = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      previousSurgeries: [...prev.previousSurgeries, { name: '', date: '' }],
    }));
  }, []);

  const handleRemoveSurgery = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      previousSurgeries: prev.previousSurgeries.filter((_, i) => i !== index),
    }));
  }, []);

  const handleChangeSurgery = useCallback((index: number, field: 'name' | 'date', value: string) => {
    setFormData((prev) => ({
      ...prev,
      previousSurgeries: prev.previousSurgeries.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      ),
    }));
  }, []);

  // Validate form using inline rules matching @historial/validators patient schema
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    // Required fields
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'El nombre completo es obligatorio';
    }

    if (!formData.birthDate) {
      newErrors.birthDate = 'La fecha de nacimiento es obligatoria';
    } else {
      const birthDate = new Date(formData.birthDate);
      if (birthDate > new Date()) {
        newErrors.birthDate = 'La fecha de nacimiento no puede ser futura';
      }
    }

    if (!formData.sex) {
      newErrors.sex = 'El sexo es obligatorio';
    }

    if (!formData.phone) {
      newErrors.phone = 'El teléfono es obligatorio';
    } else if (!/\d{10,}/.test(formData.phone)) {
      newErrors.phone = 'El teléfono debe contener al menos 10 dígitos';
    }

    // Optional email format
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'El formato del email no es válido';
    }

    // Allergies limits (max 50, each max 200 chars)
    const activeAllergies = formData.allergies.filter((a) => a.trim() !== '');
    if (activeAllergies.length > 50) {
      newErrors.allergies = 'No se pueden registrar más de 50 alergias';
    }
    formData.allergies.forEach((allergy, index) => {
      if (allergy.length > 200) {
        newErrors[`allergy_${index}`] = 'La alergia no puede exceder 200 caracteres';
      }
    });

    // Previous surgeries limits (max 30)
    const activeSurgeries = formData.previousSurgeries.filter((s) => s.name.trim() !== '');
    if (activeSurgeries.length > 30) {
      newErrors.previousSurgeries = 'No se pueden registrar más de 30 cirugías previas';
    }
    formData.previousSurgeries.forEach((surgery, index) => {
      if (surgery.name.trim() && !surgery.date) {
        newErrors[`surgery_date_${index}`] = 'La fecha de la cirugía es obligatoria';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Check for duplicates before creation
  const checkDuplicate = useCallback(async (): Promise<boolean> => {
    if (!isCreating || confirmDuplicate) return true;

    try {
      const response = await api.post<{ duplicate: DuplicateInfo | null }>(
        '/patients/check-duplicate',
        {
          fullName: formData.fullName,
          birthDate: formData.birthDate,
        }
      );

      if (response.duplicate) {
        setDuplicateAlert(response.duplicate);
        return false;
      }
      return true;
    } catch {
      // If duplicate check fails, proceed with creation
      return true;
    }
  }, [isCreating, confirmDuplicate, formData.fullName, formData.birthDate]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;

    // Check duplicates for new patients
    const canProceed = await checkDuplicate();
    if (!canProceed) return;

    setSaving(true);
    try {
      const payload = {
        fullName: formData.fullName,
        birthDate: formData.birthDate,
        sex: formData.sex,
        phone: formData.phone,
        email: formData.email || null,
        address: formData.address || null,
        bloodType: formData.bloodType || null,
        allergies: formData.allergies.filter((a) => a.trim() !== ''),
        previousSurgeries: formData.previousSurgeries
          .filter((s) => s.name.trim() !== '')
          .map((s) => ({ name: s.name, date: s.date })),
        emergencyContactName: formData.emergencyContactName || null,
        emergencyContactPhone: formData.emergencyContactPhone || null,
        emergencyContactRelation: formData.emergencyContactRelation || null,
        insuranceProvider: formData.insuranceProvider || null,
        insurancePolicyNumber: formData.insurancePolicyNumber || null,
      };

      if (patientId) {
        await api.patch(`/patients/${patientId}`, payload);
      } else {
        await api.post('/patients', payload);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onSaved?.();
    } catch (error: unknown) {
      const apiError = error as { message?: string };
      setErrors({ _form: apiError?.message || 'Error al guardar los datos del paciente' });
    } finally {
      setSaving(false);
    }
  }, [validateForm, checkDuplicate, formData, patientId, onSaved]);

  // Confirm duplicate creation
  const handleConfirmDuplicate = useCallback(() => {
    setConfirmDuplicate(true);
    setDuplicateAlert(null);
    // Re-trigger save
    handleSubmit();
  }, [handleSubmit]);

  const handleDismissDuplicate = useCallback(() => {
    setDuplicateAlert(null);
  }, []);

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      {editing && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-end gap-3"
        >
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving && (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {patientId ? 'Guardar cambios' : 'Crear paciente'}
          </button>
        </motion.div>
      )}

      {!editing && onToggleEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onToggleEdit}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Editar
          </button>
        </div>
      )}

      {/* Form error */}
      {errors._form && (
        <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
          {errors._form}
        </div>
      )}

      {/* Success confirmation */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {patientId ? 'Datos actualizados correctamente' : 'Paciente creado correctamente'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Duplicate Alert Modal */}
      <AnimatePresence>
        {duplicateAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-md w-full mx-4"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Posible duplicado
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Se encontró un paciente con datos similares:
              </p>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 mb-4">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {duplicateAlert.fullName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Fecha de nacimiento: {new Date(duplicateAlert.birthDate + 'T00:00:00').toLocaleDateString('es-MX')}
                </p>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                ¿Desea continuar con la creación de un nuevo registro?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleDismissDuplicate}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDuplicate}
                  className="px-4 py-2 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                >
                  Crear de todas formas
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sections */}
      <GeneralDataSection
        data={formData}
        editing={editing}
        errors={errors}
        onChange={handleGeneralChange}
      />

      <MedicalHistorySection
        data={formData}
        editing={editing}
        errors={errors}
        onAddAllergy={handleAddAllergy}
        onRemoveAllergy={handleRemoveAllergy}
        onChangeAllergy={handleChangeAllergy}
        onAddSurgery={handleAddSurgery}
        onRemoveSurgery={handleRemoveSurgery}
        onChangeSurgery={handleChangeSurgery}
      />

      <EmergencyContactSection
        data={formData}
        editing={editing}
        errors={errors}
        onChange={handleEmergencyChange}
      />

      <InsuranceSection
        data={formData}
        editing={editing}
        errors={errors}
        onChange={handleInsuranceChange}
      />

      {/* Bottom action bar for long forms */}
      {editing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700"
        >
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving && (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {patientId ? 'Guardar cambios' : 'Crear paciente'}
          </button>
        </motion.div>
      )}
    </div>
  );
};
