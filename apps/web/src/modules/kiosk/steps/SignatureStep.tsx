import React, { useState, useCallback } from 'react';
import { SignaturePad } from '../components/SignaturePad';

interface SignatureStepProps {
  onSubmit: (signatureDataUrl: string) => void;
  onPrevious: () => void;
  isSubmitting: boolean;
}

/**
 * SignatureStep — Step 5 (final) of the kiosk wizard.
 * Digital signature canvas. Exports signature as PNG data URL.
 * Validates: Requirement 7.2, 7.3
 */
export const SignatureStep: React.FC<SignatureStepProps> = ({
  onSubmit,
  onPrevious,
  isSubmitting,
}) => {
  const [signatureData, setSignatureData] = useState<string | null>(null);

  const handleSignatureChange = useCallback((dataUrl: string | null) => {
    setSignatureData(dataUrl);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!signatureData) return;
    onSubmit(signatureData);
  }, [signatureData, onSubmit]);

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Firma Digital
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Paso 5 de 5 — Firme en el recuadro para completar su registro
        </p>
      </div>

      <div className="flex justify-center">
        <SignaturePad
          onSignatureChange={handleSignatureChange}
          width={600}
          height={250}
          disabled={isSubmitting}
        />
      </div>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        Al firmar, confirma que los datos proporcionados son correctos y acepta
        el aviso de privacidad.
      </p>

      {/* Navigation */}
      <div className="pt-4 flex gap-4">
        <button
          type="button"
          onClick={onPrevious}
          disabled={isSubmitting}
          className="flex-1 py-4 min-h-[48px] text-lg font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 rounded-xl transition-colors focus:outline-none focus:ring-4 focus:ring-gray-300"
          aria-label="Regresar al paso anterior"
        >
          ← Anterior
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!signatureData || isSubmitting}
          className="flex-1 py-4 min-h-[48px] text-lg font-semibold text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-xl shadow-lg transition-colors focus:outline-none focus:ring-4 focus:ring-green-300"
          aria-label="Completar registro"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Registrando...
            </span>
          ) : (
            '✓ Completar registro'
          )}
        </button>
      </div>
    </div>
  );
};
