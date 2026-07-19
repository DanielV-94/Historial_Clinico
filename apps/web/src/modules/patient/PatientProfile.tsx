import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageTransition, SkeletonLoader, GlassCard } from '@/shared/components';
import { api } from '@/services/api';
import { PatientForm, PatientFormData } from './PatientForm';
import type { Patient, Allergy, PreviousSurgery } from '@historial/shared-types';

interface PatientDetailResponse {
  patient: Patient;
  allergies: Allergy[];
  previousSurgeries: PreviousSurgery[];
}

/**
 * PatientProfile — Main profile view for a patient with grouped sections.
 * Fetches patient data from GET /patients/:id and displays sections for:
 * general data, medical history, emergency contact, and insurance.
 * Supports create mode (no :id) and edit mode.
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */
export const PatientProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<string | null>(null);
  const [patientData, setPatientData] = useState<PatientFormData | null>(null);
  const [editing, setEditing] = useState(!id); // Start in edit mode for creation
  const [patientName, setPatientName] = useState('');

  const isCreating = id === 'new' || !id;

  // Fetch patient data
  useEffect(() => {
    if (isCreating) {
      setLoading(false);
      setEditing(true);
      return;
    }

    const fetchPatient = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get<PatientDetailResponse>(`/patients/${id}`);
        const { patient, allergies, previousSurgeries } = response;

        setPatientName(patient.fullName);

        const formData: PatientFormData = {
          fullName: patient.fullName,
          birthDate: patient.birthDate?.split('T')[0] || '',
          sex: patient.sex || '',
          phone: patient.phone || '',
          email: patient.email || '',
          address: patient.address || '',
          bloodType: patient.bloodType || '',
          profilePhotoPath: patient.profilePhotoPath || null,
          allergies: allergies.map((a) => a.description),
          previousSurgeries: previousSurgeries.map((s) => ({
            name: s.name,
            date: s.surgeryDate?.split('T')[0] || '',
          })),
          emergencyContactName: patient.emergencyContactName || '',
          emergencyContactPhone: patient.emergencyContactPhone || '',
          emergencyContactRelation: patient.emergencyContactRelation || '',
          insuranceProvider: patient.insuranceProvider || '',
          insurancePolicyNumber: patient.insurancePolicyNumber || '',
        };

        setPatientData(formData);
      } catch (err: unknown) {
        const apiErr = err as { status?: number; message?: string };
        if (apiErr.status === 404) {
          setError('Paciente no encontrado');
        } else {
          setError(apiErr.message || 'Error al cargar los datos del paciente');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPatient();
  }, [id, isCreating]);

  // Handle save success
  const handleSaved = useCallback(() => {
    setEditing(false);
    if (isCreating) {
      navigate('/patients');
    } else {
      // Refresh data
      window.location.reload();
    }
  }, [isCreating, navigate]);

  // Handle cancel edit
  const handleCancel = useCallback(() => {
    if (isCreating) {
      navigate('/patients');
    } else {
      setEditing(false);
    }
  }, [isCreating, navigate]);

  // Toggle edit mode
  const handleToggleEdit = useCallback(() => {
    setEditing(true);
  }, []);

  // Loading state
  if (loading) {
    return (
      <PageTransition transitionKey="patient-loading">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <SkeletonLoader width="48px" height="48px" rounded />
            <div className="space-y-2">
              <SkeletonLoader width="200px" height="24px" />
              <SkeletonLoader width="120px" height="16px" />
            </div>
          </div>
          <SkeletonLoader width="100%" height="200px" />
          <SkeletonLoader width="100%" height="160px" />
          <SkeletonLoader width="100%" height="120px" />
          <SkeletonLoader width="100%" height="100px" />
        </div>
      </PageTransition>
    );
  }

  // Error state
  if (error) {
    return (
      <PageTransition transitionKey="patient-error">
        <GlassCard className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {error}
          </h2>
          <button
            type="button"
            onClick={() => navigate('/patients')}
            className="mt-4 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Volver a pacientes
          </button>
        </GlassCard>
      </PageTransition>
    );
  }

  return (
    <PageTransition transitionKey={`patient-profile-${id || 'new'}`}>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-4"
        >
          <button
            type="button"
            onClick={() => navigate('/patients')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Volver a lista de pacientes"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Patient avatar / initials */}
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-lg font-bold shadow-lg">
            {isCreating
              ? '+'
              : (patientName || '')
                  .split(' ')
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
              {isCreating ? 'Nuevo Paciente' : patientName}
            </h1>
            {!isCreating && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Perfil del paciente
              </p>
            )}
          </div>
        </motion.div>

        {/* Patient Form */}
        <PatientForm
          initialData={patientData || undefined}
          patientId={isCreating ? undefined : id}
          editing={editing}
          onSaved={handleSaved}
          onCancel={handleCancel}
          onToggleEdit={handleToggleEdit}
        />
      </div>
    </PageTransition>
  );
};
