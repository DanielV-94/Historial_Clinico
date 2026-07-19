import React, { useState, useCallback } from 'react';

export interface EmergencyContactData {
  contactName: string;
  contactPhone: string;
  relationship: string;
}

interface EmergencyContactStepProps {
  data: EmergencyContactData;
  onChange: (data: EmergencyContactData) => void;
  onNext: () => void;
  onPrevious: () => void;
}

interface FieldErrors {
  contactName?: string;
  contactPhone?: string;
  relationship?: string;
}

/**
 * EmergencyContactStep — Step 3 of the kiosk wizard.
 * Collects: emergency contact name, phone, relationship.
 * Validates: Requirement 7.1
 */
export const EmergencyContactStep: React.FC<EmergencyContactStepProps> = ({
  data,
  onChange,
  onNext,
  onPrevious,
}) => {
  const [errors, setErrors] = useState<FieldErrors>({});

  const validateField = useCallback(
    (field: keyof EmergencyContactData, value: string): string | undefined => {
      switch (field) {
        case 'contactName':
          if (!value.trim()) return 'El nombre del contacto es obligatorio';
          if (value.trim().length < 3) return 'Mínimo 3 caracteres';
          return undefined;
        case 'contactPhone':
          if (!value.trim()) return 'El teléfono es obligatorio';
          if (value.replace(/\D/g, '').length < 10) return 'Mínimo 10 dígitos';
          return undefined;
        case 'relationship':
          if (!value.trim()) return 'El parentesco es obligatorio';
          return undefined;
        default:
          return undefined;
      }
    },
    []
  );

  const handleChange = useCallback(
    (field: keyof EmergencyContactData, value: string) => {
      const newData = { ...data, [field]: value };
      onChange(newData);
      const error = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: error }));
    },
    [data, onChange, validateField]
  );

  const handleNext = useCallback(() => {
    const newErrors: FieldErrors = {};
    newErrors.contactName = validateField('contactName', data.contactName);
    newErrors.contactPhone = validateField('contactPhone', data.contactPhone);
    newErrors.relationship = validateField('relationship', data.relationship);

    const filteredErrors = Object.fromEntries(
      Object.entries(newErrors).filter(([, v]) => v !== undefined)
    );

    setErrors(filteredErrors as FieldErrors);

    if (Object.keys(filteredErrors).length > 0) return;

    onNext();
  }, [data, validateField, onNext]);

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Contacto de Emergencia
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Paso 3 de 5
        </p>
      </div>

      <div className="space-y-5">
        {/* Contact Name */}
        <div>
          <label
            htmlFor="kiosk-contactName"
            className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Nombre del contacto *
          </label>
          <input
            id="kiosk-contactName"
            type="text"
            value={data.contactName}
            onChange={(e) => handleChange('contactName', e.target.value)}
            className={`w-full px-4 py-4 text-lg rounded-xl border ${
              errors.contactName
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
            } dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 transition-colors`}
            placeholder="Nombre completo"
            autoComplete="off"
          />
          {errors.contactName && (
            <p className="mt-1 text-sm text-red-500">{errors.contactName}</p>
          )}
        </div>

        {/* Contact Phone */}
        <div>
          <label
            htmlFor="kiosk-contactPhone"
            className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Teléfono del contacto *
          </label>
          <input
            id="kiosk-contactPhone"
            type="tel"
            value={data.contactPhone}
            onChange={(e) => handleChange('contactPhone', e.target.value)}
            className={`w-full px-4 py-4 text-lg rounded-xl border ${
              errors.contactPhone
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
            } dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 transition-colors`}
            placeholder="10 dígitos"
            autoComplete="off"
          />
          {errors.contactPhone && (
            <p className="mt-1 text-sm text-red-500">{errors.contactPhone}</p>
          )}
        </div>

        {/* Relationship */}
        <div>
          <label
            htmlFor="kiosk-relationship"
            className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Parentesco *
          </label>
          <select
            id="kiosk-relationship"
            value={data.relationship}
            onChange={(e) => handleChange('relationship', e.target.value)}
            className={`w-full px-4 py-4 text-lg rounded-xl border ${
              errors.relationship
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
            } dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 transition-colors`}
          >
            <option value="">Seleccione...</option>
            <option value="Esposo/a">Esposo/a</option>
            <option value="Padre">Padre</option>
            <option value="Madre">Madre</option>
            <option value="Hijo/a">Hijo/a</option>
            <option value="Hermano/a">Hermano/a</option>
            <option value="Otro">Otro</option>
          </select>
          {errors.relationship && (
            <p className="mt-1 text-sm text-red-500">{errors.relationship}</p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="pt-6 flex gap-4">
        <button
          type="button"
          onClick={onPrevious}
          className="flex-1 py-4 min-h-[48px] text-lg font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors focus:outline-none focus:ring-4 focus:ring-gray-300"
          aria-label="Regresar al paso anterior"
        >
          ← Anterior
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="flex-1 py-4 min-h-[48px] text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg transition-colors focus:outline-none focus:ring-4 focus:ring-blue-300"
          aria-label="Continuar al siguiente paso"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
};
