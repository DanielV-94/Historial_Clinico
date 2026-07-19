import React, { useState, useCallback } from 'react';

export interface PersonalData {
  fullName: string;
  birthDate: string;
  sex: 'male' | 'female' | 'other' | '';
  phone: string;
  email: string;
  address: string;
}

interface PersonalDataStepProps {
  data: PersonalData;
  onChange: (data: PersonalData) => void;
  onNext: () => void;
  onDuplicate: () => void;
}

interface FieldErrors {
  fullName?: string;
  birthDate?: string;
  sex?: string;
  phone?: string;
  email?: string;
}

/**
 * PersonalDataStep — Step 1 of the kiosk wizard.
 * Collects: name, birthDate, sex, phone, email, address.
 * Validates inline before allowing next step.
 * Validates: Requirement 7.1, 7.4, 7.6
 */
export const PersonalDataStep: React.FC<PersonalDataStepProps> = ({
  data,
  onChange,
  onNext,
  onDuplicate,
}) => {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const validateField = useCallback(
    (field: keyof PersonalData, value: string): string | undefined => {
      switch (field) {
        case 'fullName':
          if (!value.trim()) return 'El nombre es obligatorio';
          if (value.trim().length < 3) return 'Mínimo 3 caracteres';
          return undefined;
        case 'birthDate':
          if (!value) return 'La fecha de nacimiento es obligatoria';
          if (new Date(value) > new Date()) return 'La fecha no puede ser futura';
          return undefined;
        case 'sex':
          if (!value) return 'Seleccione el sexo';
          return undefined;
        case 'phone':
          if (!value.trim()) return 'El teléfono es obligatorio';
          if (value.replace(/\D/g, '').length < 10)
            return 'Mínimo 10 dígitos';
          return undefined;
        case 'email':
          if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
            return 'Formato de correo inválido';
          return undefined;
        default:
          return undefined;
      }
    },
    []
  );

  const handleChange = useCallback(
    (field: keyof PersonalData, value: string) => {
      const newData = { ...data, [field]: value };
      onChange(newData);

      // Clear error on change
      const error = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: error }));
    },
    [data, onChange, validateField]
  );

  const checkDuplicate = useCallback(async (): Promise<boolean> => {
    if (!data.fullName.trim() || !data.birthDate) return false;

    setCheckingDuplicate(true);
    try {
      const params = new URLSearchParams({
        fullName: data.fullName.trim(),
        birthDate: data.birthDate,
      });
      const response = await fetch(`/api/patients/check-duplicate?${params}`, {
        method: 'GET',
      });
      if (response.ok) {
        const result = await response.json();
        if (result.isDuplicate) {
          onDuplicate();
          return true;
        }
      }
      return false;
    } catch {
      // If check fails, allow to proceed
      return false;
    } finally {
      setCheckingDuplicate(false);
    }
  }, [data.fullName, data.birthDate, onDuplicate]);

  const handleNext = useCallback(async () => {
    const newErrors: FieldErrors = {};
    newErrors.fullName = validateField('fullName', data.fullName);
    newErrors.birthDate = validateField('birthDate', data.birthDate);
    newErrors.sex = validateField('sex', data.sex);
    newErrors.phone = validateField('phone', data.phone);
    newErrors.email = validateField('email', data.email);

    // Filter out undefined values
    const filteredErrors = Object.fromEntries(
      Object.entries(newErrors).filter(([, v]) => v !== undefined)
    );

    setErrors(filteredErrors as FieldErrors);

    if (Object.keys(filteredErrors).length > 0) return;

    // Check for duplicate before proceeding
    const isDuplicate = await checkDuplicate();
    if (isDuplicate) return;

    onNext();
  }, [data, validateField, checkDuplicate, onNext]);

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Datos Personales
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Paso 1 de 5
        </p>
      </div>

      <div className="space-y-5">
        {/* Full Name */}
        <div>
          <label
            htmlFor="kiosk-fullName"
            className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Nombre completo *
          </label>
          <input
            id="kiosk-fullName"
            type="text"
            value={data.fullName}
            onChange={(e) => handleChange('fullName', e.target.value)}
            className={`w-full px-4 py-4 text-lg rounded-xl border ${
              errors.fullName
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
            } dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 transition-colors`}
            placeholder="Nombre completo"
            autoComplete="name"
          />
          {errors.fullName && (
            <p className="mt-1 text-sm text-red-500">{errors.fullName}</p>
          )}
        </div>

        {/* Birth Date */}
        <div>
          <label
            htmlFor="kiosk-birthDate"
            className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Fecha de nacimiento *
          </label>
          <input
            id="kiosk-birthDate"
            type="date"
            value={data.birthDate}
            onChange={(e) => handleChange('birthDate', e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className={`w-full px-4 py-4 text-lg rounded-xl border ${
              errors.birthDate
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
            } dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 transition-colors`}
          />
          {errors.birthDate && (
            <p className="mt-1 text-sm text-red-500">{errors.birthDate}</p>
          )}
        </div>

        {/* Sex */}
        <div>
          <label
            htmlFor="kiosk-sex"
            className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Sexo *
          </label>
          <select
            id="kiosk-sex"
            value={data.sex}
            onChange={(e) => handleChange('sex', e.target.value)}
            className={`w-full px-4 py-4 text-lg rounded-xl border ${
              errors.sex
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
            } dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 transition-colors`}
          >
            <option value="">Seleccione...</option>
            <option value="male">Masculino</option>
            <option value="female">Femenino</option>
            <option value="other">Otro</option>
          </select>
          {errors.sex && (
            <p className="mt-1 text-sm text-red-500">{errors.sex}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label
            htmlFor="kiosk-phone"
            className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Teléfono *
          </label>
          <input
            id="kiosk-phone"
            type="tel"
            value={data.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className={`w-full px-4 py-4 text-lg rounded-xl border ${
              errors.phone
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
            } dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 transition-colors`}
            placeholder="10 dígitos"
            autoComplete="tel"
          />
          {errors.phone && (
            <p className="mt-1 text-sm text-red-500">{errors.phone}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="kiosk-email"
            className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Correo electrónico
          </label>
          <input
            id="kiosk-email"
            type="email"
            value={data.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className={`w-full px-4 py-4 text-lg rounded-xl border ${
              errors.email
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
            } dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 transition-colors`}
            placeholder="correo@ejemplo.com"
            autoComplete="email"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-500">{errors.email}</p>
          )}
        </div>

        {/* Address */}
        <div>
          <label
            htmlFor="kiosk-address"
            className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Dirección
          </label>
          <input
            id="kiosk-address"
            type="text"
            value={data.address}
            onChange={(e) => handleChange('address', e.target.value)}
            className="w-full px-4 py-4 text-lg rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            placeholder="Dirección completa"
            autoComplete="street-address"
          />
        </div>
      </div>

      {/* Next button */}
      <div className="pt-6">
        <button
          type="button"
          onClick={handleNext}
          disabled={checkingDuplicate}
          className="w-full py-4 min-h-[48px] text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-xl shadow-lg transition-colors focus:outline-none focus:ring-4 focus:ring-blue-300"
          aria-label="Continuar al siguiente paso"
        >
          {checkingDuplicate ? 'Verificando...' : 'Siguiente →'}
        </button>
      </div>
    </div>
  );
};
