import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PersonalDataStep, type PersonalData } from './steps/PersonalDataStep';
import {
  MedicalHistoryStep,
  type MedicalHistoryData,
} from './steps/MedicalHistoryStep';
import {
  EmergencyContactStep,
  type EmergencyContactData,
} from './steps/EmergencyContactStep';
import { PrivacyNoticeStep } from './steps/PrivacyNoticeStep';
import { SignatureStep } from './steps/SignatureStep';
import { useKioskInactivity } from './hooks/useKioskInactivity';

type WizardStep =
  | 'personal'
  | 'medical'
  | 'emergency'
  | 'privacy'
  | 'signature';

const STEP_ORDER: WizardStep[] = [
  'personal',
  'medical',
  'emergency',
  'privacy',
  'signature',
];

interface WizardState {
  personalData: PersonalData;
  medicalHistory: MedicalHistoryData;
  emergencyContact: EmergencyContactData;
}

const INITIAL_STATE: WizardState = {
  personalData: {
    fullName: '',
    birthDate: '',
    sex: '',
    phone: '',
    email: '',
    address: '',
  },
  medicalHistory: {
    allergies: [],
    previousSurgeries: [],
    bloodType: '',
  },
  emergencyContact: {
    contactName: '',
    contactPhone: '',
    relationship: '',
  },
};

/**
 * KioskWizard — Main wizard orchestrator for patient self-registration.
 * Flow: Personal Data → Medical History → Emergency Contact → Privacy Notice → Signature
 * Features:
 * - Inactivity timeout (3 min) → clears data → resets to welcome
 * - Duplicate detection (name + birthDate)
 * - Framer Motion step transitions
 * - Apple PWA meta tags for standalone iPad mode
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.5
 */
export const KioskWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('personal');
  const [wizardData, setWizardData] = useState<WizardState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showTimeout, setShowTimeout] = useState(false);

  // Reset all form data and go back to first step
  const resetWizard = useCallback(() => {
    setWizardData(INITIAL_STATE);
    setCurrentStep('personal');
    setIsSubmitting(false);
    setShowDuplicate(false);
    setShowSuccess(false);
    setShowTimeout(false);
  }, []);

  // Inactivity timeout handler
  const handleInactivityTimeout = useCallback(() => {
    setShowTimeout(true);
    // After a short delay, reset
    setTimeout(() => {
      resetWizard();
    }, 3000);
  }, [resetWizard]);

  // Only enable inactivity timer when not showing results
  useKioskInactivity(handleInactivityTimeout, !showSuccess && !showTimeout);

  // Navigation helpers
  const goToStep = useCallback((step: WizardStep) => {
    setCurrentStep(step);
  }, []);

  const goNext = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex < STEP_ORDER.length - 1) {
      setCurrentStep(STEP_ORDER[currentIndex + 1]);
    }
  }, [currentStep]);

  const goPrevious = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEP_ORDER[currentIndex - 1]);
    }
  }, [currentStep]);

  // Duplicate detection handler
  const handleDuplicate = useCallback(() => {
    setShowDuplicate(true);
  }, []);

  // Submit registration
  const handleSubmit = useCallback(
    async (signatureDataUrl: string) => {
      setIsSubmitting(true);
      try {
        const payload = {
          personalData: wizardData.personalData,
          medicalHistory: wizardData.medicalHistory,
          emergencyContact: wizardData.emergencyContact,
          signature: signatureDataUrl,
        };

        const response = await fetch('/api/kiosk/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          setShowSuccess(true);
          // Auto-reset after 8 seconds
          setTimeout(() => {
            resetWizard();
          }, 8000);
        } else {
          const error = await response.json().catch(() => null);
          alert(
            error?.message ||
              'Error al registrar. Contacte a recepción.'
          );
          setIsSubmitting(false);
        }
      } catch {
        alert('Error de conexión. Contacte a recepción.');
        setIsSubmitting(false);
      }
    },
    [wizardData, resetWizard]
  );

  // Duplicate message overlay
  if (showDuplicate) {
    return (
      <div className="flex flex-col items-center justify-center text-center space-y-6 py-12">
        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
          <svg
            className="w-10 h-10 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Paciente ya registrado
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md">
          Un paciente con el mismo nombre y fecha de nacimiento ya existe en el
          sistema. Por favor contacte a recepción para asistencia.
        </p>
        <button
          type="button"
          onClick={resetWizard}
          className="mt-4 px-8 py-4 min-h-[48px] text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg transition-colors focus:outline-none focus:ring-4 focus:ring-blue-300"
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  // Success message
  if (showSuccess) {
    return (
      <div className="flex flex-col items-center justify-center text-center space-y-6 py-12">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
          <svg
            className="w-10 h-10 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          ¡Registro exitoso!
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md">
          Su registro ha sido completado. Recepción ha sido notificada.
          Por favor tome asiento, le llamaremos en breve.
        </p>
        <p className="text-sm text-gray-400">
          Esta pantalla se reiniciará automáticamente...
        </p>
      </div>
    );
  }

  // Timeout message
  if (showTimeout) {
    return (
      <div className="flex flex-col items-center justify-center text-center space-y-6 py-12">
        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
          <svg
            className="w-10 h-10 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Sesión expirada
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Por inactividad, el formulario será reiniciado.
        </p>
      </div>
    );
  }

  // Step progress indicator
  const currentStepIndex = STEP_ORDER.indexOf(currentStep);

  return (
    <div className="space-y-6">
      {/* Step progress bar */}
      <div className="flex items-center justify-center gap-2 mb-4">
        {STEP_ORDER.map((step, index) => (
          <React.Fragment key={step}>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                index <= currentStepIndex
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
              }`}
              aria-label={`Paso ${index + 1}`}
            >
              {index + 1}
            </div>
            {index < STEP_ORDER.length - 1 && (
              <div
                className={`w-8 h-1 rounded ${
                  index < currentStepIndex
                    ? 'bg-blue-600'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Animated step transitions */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.25 }}
        >
          {currentStep === 'personal' && (
            <PersonalDataStep
              data={wizardData.personalData}
              onChange={(data) =>
                setWizardData((prev) => ({ ...prev, personalData: data }))
              }
              onNext={goNext}
              onDuplicate={handleDuplicate}
            />
          )}

          {currentStep === 'medical' && (
            <MedicalHistoryStep
              data={wizardData.medicalHistory}
              onChange={(data) =>
                setWizardData((prev) => ({ ...prev, medicalHistory: data }))
              }
              onNext={goNext}
              onPrevious={goPrevious}
            />
          )}

          {currentStep === 'emergency' && (
            <EmergencyContactStep
              data={wizardData.emergencyContact}
              onChange={(data) =>
                setWizardData((prev) => ({ ...prev, emergencyContact: data }))
              }
              onNext={goNext}
              onPrevious={goPrevious}
            />
          )}

          {currentStep === 'privacy' && (
            <PrivacyNoticeStep onNext={goNext} onPrevious={goPrevious} />
          )}

          {currentStep === 'signature' && (
            <SignatureStep
              onSubmit={handleSubmit}
              onPrevious={goPrevious}
              isSubmitting={isSubmitting}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
