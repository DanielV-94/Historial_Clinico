import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUploader, GlassCard } from '@/shared/components';
import { api } from '@/services/api';
import { PDF_MAX_SIZE } from '@historial/constants';

interface DocumentUploadProps {
  patientId: string;
  onUploadSuccess: () => void;
  existingDocumentNames: string[];
}

/**
 * DocumentUpload — Upload PDF documents with validation (≤20MB, PDF only).
 * Handles duplicate name detection with replacement confirmation.
 * Validates: Requirements 2.1, 2.4, 2.6
 */
export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  patientId,
  onUploadSuccess,
  existingDocumentNames,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [studyType, setStudyType] = useState('');
  const [uploading, setUploading] = useState(false);

  const uploadFile = async (file: File, replace = false) => {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (studyType.trim()) {
        formData.append('studyType', studyType.trim());
      }
      if (replace) {
        formData.append('replace', 'true');
      }

      await api.upload(`/patients/${patientId}/documents`, formData);

      setStudyType('');
      onUploadSuccess();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message || 'Error al subir el archivo';
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async (file: File) => {
    // Check for duplicate name
    const isDuplicate = existingDocumentNames.some(
      (name) => name.toLowerCase() === file.name.toLowerCase()
    );

    if (isDuplicate) {
      setPendingFile(file);
      setShowDuplicateModal(true);
      return;
    }

    await uploadFile(file);
  };

  const handleConfirmReplace = async () => {
    setShowDuplicateModal(false);
    if (pendingFile) {
      await uploadFile(pendingFile, true);
      setPendingFile(null);
    }
  };

  const handleCancelReplace = () => {
    setShowDuplicateModal(false);
    setPendingFile(null);
  };

  return (
    <GlassCard className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Subir documento PDF
      </h3>

      {/* Study type input */}
      <div className="mb-4">
        <label
          htmlFor="study-type"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Tipo de estudio (opcional)
        </label>
        <input
          id="study-type"
          type="text"
          value={studyType}
          onChange={(e) => setStudyType(e.target.value)}
          placeholder="Ej: Rayos X, Resonancia Magnética..."
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          disabled={uploading}
        />
      </div>

      {/* File uploader */}
      <FileUploader
        accept={['application/pdf']}
        maxSize={PDF_MAX_SIZE}
        onUpload={handleUpload}
        onError={(msg) => setError(msg)}
        disabled={uploading}
        label="Arrastra un PDF aquí o haz clic para seleccionar"
      />

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3"
          >
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              {error}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Duplicate confirmation modal */}
      <AnimatePresence>
        {showDuplicateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="duplicate-modal-title"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
            >
              <h4
                id="duplicate-modal-title"
                className="text-lg font-semibold text-gray-900 dark:text-white mb-2"
              >
                Archivo duplicado
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Ya existe un archivo con el nombre{' '}
                <span className="font-medium">"{pendingFile?.name}"</span> en el
                expediente de este paciente. ¿Deseas reemplazarlo?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleCancelReplace}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmReplace}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Reemplazar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
};
