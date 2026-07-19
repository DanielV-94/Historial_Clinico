import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { GlassCard, SkeletonLoader } from '@/shared/components';

interface DocumentPreviewProps {
  patientId: string;
  documentId: string;
  documentName: string;
  onClose: () => void;
}

/**
 * DocumentPreview — Inline PDF preview using an iframe/object embed.
 * Shows a loading skeleton while the PDF loads.
 * Validates: Requirements 2.2
 */
export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  patientId,
  documentId,
  documentName,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const previewUrl = `/api/patients/${patientId}/documents/${documentId}/preview`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-5xl h-[90vh] flex flex-col"
      >
        <GlassCard className="flex flex-col h-full overflow-hidden" opacity={0.95}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3
              id="preview-title"
              className="text-lg font-semibold text-gray-900 dark:text-white truncate mr-4"
            >
              {documentName}
            </h3>
            <div className="flex items-center gap-2">
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Abrir en nueva pestaña"
                title="Abrir en nueva pestaña"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Cerrar vista previa"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* PDF content area */}
          <div className="flex-1 relative overflow-hidden">
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8">
                <SkeletonLoader width="100%" height="100%" delay={0} className="absolute inset-0" />
                <p className="relative z-10 text-sm text-gray-500 dark:text-gray-400">
                  Cargando documento...
                </p>
              </div>
            )}

            {error ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
                <svg
                  className="w-12 h-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  No se pudo cargar el documento.
                </p>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                >
                  Intentar abrir en nueva pestaña
                </a>
              </div>
            ) : (
              <iframe
                src={previewUrl}
                title={`Vista previa de ${documentName}`}
                className="w-full h-full border-0"
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError(true);
                }}
              />
            )}
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
};
