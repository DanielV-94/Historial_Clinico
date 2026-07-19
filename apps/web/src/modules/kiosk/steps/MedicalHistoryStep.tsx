import React, { useState, useCallback } from 'react';

export interface MedicalHistoryData {
  allergies: string[];
  previousSurgeries: { name: string; date: string }[];
  bloodType: string;
}

interface MedicalHistoryStepProps {
  data: MedicalHistoryData;
  onChange: (data: MedicalHistoryData) => void;
  onNext: () => void;
  onPrevious: () => void;
}

/**
 * MedicalHistoryStep — Step 2 of the kiosk wizard.
 * Collects: allergies, previous surgeries, blood type.
 * Validates: Requirement 7.1
 */
export const MedicalHistoryStep: React.FC<MedicalHistoryStepProps> = ({
  data,
  onChange,
  onNext,
  onPrevious,
}) => {
  const [allergyInput, setAllergyInput] = useState('');
  const [surgeryName, setSurgeryName] = useState('');
  const [surgeryDate, setSurgeryDate] = useState('');

  const addAllergy = useCallback(() => {
    const trimmed = allergyInput.trim();
    if (!trimmed) return;
    if (data.allergies.length >= 50) return;
    if (trimmed.length > 200) return;
    onChange({ ...data, allergies: [...data.allergies, trimmed] });
    setAllergyInput('');
  }, [allergyInput, data, onChange]);

  const removeAllergy = useCallback(
    (index: number) => {
      const updated = data.allergies.filter((_, i) => i !== index);
      onChange({ ...data, allergies: updated });
    },
    [data, onChange]
  );

  const addSurgery = useCallback(() => {
    const trimmedName = surgeryName.trim();
    if (!trimmedName) return;
    if (data.previousSurgeries.length >= 30) return;
    onChange({
      ...data,
      previousSurgeries: [
        ...data.previousSurgeries,
        { name: trimmedName, date: surgeryDate },
      ],
    });
    setSurgeryName('');
    setSurgeryDate('');
  }, [surgeryName, surgeryDate, data, onChange]);

  const removeSurgery = useCallback(
    (index: number) => {
      const updated = data.previousSurgeries.filter((_, i) => i !== index);
      onChange({ ...data, previousSurgeries: updated });
    },
    [data, onChange]
  );

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Antecedentes Médicos
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Paso 2 de 5
        </p>
      </div>

      <div className="space-y-6">
        {/* Blood Type */}
        <div>
          <label
            htmlFor="kiosk-bloodType"
            className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Tipo de sangre
          </label>
          <select
            id="kiosk-bloodType"
            value={data.bloodType}
            onChange={(e) => onChange({ ...data, bloodType: e.target.value })}
            className="w-full px-4 py-4 text-lg rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            <option value="">Seleccione...</option>
            <option value="A+">A+</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B-">B-</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB-</option>
            <option value="O+">O+</option>
            <option value="O-">O-</option>
          </select>
        </div>

        {/* Allergies */}
        <div>
          <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">
            Alergias
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={allergyInput}
              onChange={(e) => setAllergyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addAllergy();
                }
              }}
              className="flex-1 px-4 py-4 text-lg rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              placeholder="Ej: Penicilina"
              maxLength={200}
            />
            <button
              type="button"
              onClick={addAllergy}
              disabled={!allergyInput.trim() || data.allergies.length >= 50}
              className="px-5 py-4 min-h-[48px] text-lg font-semibold text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400 rounded-xl transition-colors"
              aria-label="Agregar alergia"
            >
              +
            </button>
          </div>
          {data.allergies.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {data.allergies.map((allergy, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800"
                >
                  {allergy}
                  <button
                    type="button"
                    onClick={() => removeAllergy(i)}
                    className="ml-1 text-red-500 hover:text-red-700 font-bold"
                    aria-label={`Eliminar alergia: ${allergy}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs text-gray-400">
            {data.allergies.length}/50 alergias registradas
          </p>
        </div>

        {/* Previous Surgeries */}
        <div>
          <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">
            Cirugías previas
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={surgeryName}
              onChange={(e) => setSurgeryName(e.target.value)}
              className="flex-1 px-4 py-4 text-lg rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              placeholder="Nombre de cirugía"
            />
            <input
              type="date"
              value={surgeryDate}
              onChange={(e) => setSurgeryDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-44 px-4 py-4 text-lg rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            />
            <button
              type="button"
              onClick={addSurgery}
              disabled={
                !surgeryName.trim() || data.previousSurgeries.length >= 30
              }
              className="px-5 py-4 min-h-[48px] text-lg font-semibold text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400 rounded-xl transition-colors"
              aria-label="Agregar cirugía"
            >
              +
            </button>
          </div>
          {data.previousSurgeries.length > 0 && (
            <ul className="mt-3 space-y-2">
              {data.previousSurgeries.map((surgery, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <span className="text-gray-800 dark:text-gray-200">
                    {surgery.name}
                    {surgery.date && (
                      <span className="ml-2 text-sm text-gray-500">
                        ({surgery.date})
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSurgery(i)}
                    className="text-red-500 hover:text-red-700 font-bold min-w-[32px] min-h-[32px]"
                    aria-label={`Eliminar cirugía: ${surgery.name}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-xs text-gray-400">
            {data.previousSurgeries.length}/30 cirugías registradas
          </p>
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
          onClick={onNext}
          className="flex-1 py-4 min-h-[48px] text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg transition-colors focus:outline-none focus:ring-4 focus:ring-blue-300"
          aria-label="Continuar al siguiente paso"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
};
