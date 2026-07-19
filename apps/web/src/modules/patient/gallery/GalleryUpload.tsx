import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUploader, GlassCard } from '@/shared/components';
import { api } from '@/services/api';

/** Accepted image MIME types */
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/heic'];
/** Accepted video MIME types */
const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime'];
/** All accepted MIME types */
const ALL_ACCEPTED_TYPES = [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES];

/** Max image size: 50 MB */
const IMAGE_MAX_SIZE = 50 * 1024 * 1024;
/** Max video size: 200 MB */
const VIDEO_MAX_SIZE = 200 * 1024 * 1024;

export interface GalleryUploadProps {
  patientId: string;
  /** Callback when upload completes successfully */
  onUploadSuccess: () => void;
}

/**
 * GalleryUpload — Upload component for photos/videos with format and size validation.
 * Accepts images (JPEG, PNG, HEIC ≤50MB) and videos (MP4, MOV ≤200MB).
 * Includes metadata fields: capture date, anatomical zone, observations.
 * Validates: Requirements 3.1, 3.5, 3.6
 */
export const GalleryUpload: React.FC<GalleryUploadProps> = ({
  patientId,
  onUploadSuccess,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [captureDate, setCaptureDate] = useState('');
  const [anatomicalZone, setAnatomicalZone] = useState('');
  const [observations, setObservations] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const getMaxSizeForFile = (file: File): number => {
    if (VIDEO_MIME_TYPES.includes(file.type)) return VIDEO_MAX_SIZE;
    return IMAGE_MAX_SIZE;
  };

  const validateFileSize = (file: File): string | null => {
    const maxSize = getMaxSizeForFile(file);
    if (file.size > maxSize) {
      const maxMB = maxSize / (1024 * 1024);
      const fileMB = (file.size / (1024 * 1024)).toFixed(1);
      const type = VIDEO_MIME_TYPES.includes(file.type) ? 'video' : 'imagen';
      return `El archivo ${type} excede el tamaño máximo de ${maxMB} MB. Tamaño: ${fileMB} MB`;
    }
    return null;
  };

  const handleUpload = async (file: File) => {
    // Additional size validation based on type
    const sizeError = validateFileSize(file);
    if (sizeError) {
      setError(sizeError);
      throw new Error(sizeError);
    }

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (captureDate) formData.append('captureDate', captureDate);
      if (anatomicalZone) formData.append('anatomicalZone', anatomicalZone);
      if (observations) formData.append('notes', observations);

      await api.upload(`/patients/${patientId}/gallery`, formData);

      // Reset form
      setCaptureDate('');
      setAnatomicalZone('');
      setObservations('');
      setShowForm(false);
      onUploadSuccess();
    } catch (err) {
      if (err instanceof Error && err.message === sizeError) throw err;
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Error al subir el archivo';
      setError(message);
      throw new Error(message);
    } finally {
      setUploading(false);
    }
  };

  const handleError = (errorMsg: string) => {
    setError(errorMsg);
  };

  // Dynamic max size for the FileUploader (use largest possible)
  const maxSizeForUploader = VIDEO_MAX_SIZE;

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Subir multimedia
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
        >
          {showForm ? 'Ocultar' : 'Agregar metadatos'}
        </button>
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Metadata fields (collapsible) */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-hidden"
          >
            <div>
              <label
                htmlFor="gallery-capture-date"
                className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Fecha de captura
              </label>
              <input
                id="gallery-capture-date"
                type="date"
                value={captureDate}
                onChange={(e) => setCaptureDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="gallery-zone"
                className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Zona anatómica
              </label>
              <input
                id="gallery-zone"
                type="text"
                value={anatomicalZone}
                onChange={(e) => setAnatomicalZone(e.target.value)}
                placeholder="Ej: Rostro, Abdomen, Brazos"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
              />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="gallery-observations"
                className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Observaciones
              </label>
              <textarea
                id="gallery-observations"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={2}
                placeholder="Notas sobre esta captura..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-colors"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File uploader */}
      <FileUploader
        accept={ALL_ACCEPTED_TYPES}
        maxSize={maxSizeForUploader}
        onUpload={handleUpload}
        onError={handleError}
        disabled={uploading}
        label="Arrastra una foto o video aquí, o haz clic para seleccionar"
      />

      {/* Format info */}
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 text-center">
        Imágenes: JPEG, PNG, HEIC (máx. 50 MB) · Videos: MP4, MOV (máx. 200 MB)
      </p>
    </GlassCard>
  );
};
