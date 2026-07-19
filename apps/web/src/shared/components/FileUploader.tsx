import React, { useCallback, useRef, useState } from 'react';

export interface FileUploaderProps {
  /** Accepted MIME types (e.g., ['application/pdf', 'image/jpeg']) */
  accept: string[];
  /** Maximum file size in bytes */
  maxSize: number;
  /** Callback when file upload completes */
  onUpload: (file: File) => Promise<void>;
  /** Callback on validation or upload error */
  onError?: (error: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Custom label text */
  label?: string;
  /** Whether the uploader is disabled */
  disabled?: boolean;
}

/**
 * FileUploader — Drag & drop zone with MIME type/size validation and progress bar.
 * Validates: Requirements 11.2, 2.4
 */
export const FileUploader: React.FC<FileUploaderProps> = ({
  accept,
  maxSize,
  onUpload,
  onError,
  className = '',
  label = 'Arrastra un archivo aquí o haz clic para seleccionar',
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number): string => {
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
    if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const validateFile = (file: File): string | null => {
    if (!accept.includes(file.type)) {
      return `Tipo de archivo no permitido: ${file.type || 'desconocido'}. Permitidos: ${accept.join(', ')}`;
    }
    if (file.size > maxSize) {
      return `El archivo excede el tamaño máximo (${formatSize(maxSize)}). Tamaño: ${formatSize(file.size)}`;
    }
    return null;
  };

  const handleFile = useCallback(
    async (file: File) => {
      const error = validateFile(file);
      if (error) {
        onError?.(error);
        return;
      }

      setFileName(file.name);
      setProgress(0);

      try {
        // Simulate progress while awaiting upload
        const progressInterval = setInterval(() => {
          setProgress((prev) => {
            if (prev === null || prev >= 90) return prev;
            return prev + 10;
          });
        }, 200);

        await onUpload(file);

        clearInterval(progressInterval);
        setProgress(100);

        // Reset after success
        setTimeout(() => {
          setProgress(null);
          setFileName(null);
        }, 1500);
      } catch (err) {
        setProgress(null);
        setFileName(null);
        const message = err instanceof Error ? err.message : 'Error al subir el archivo';
        onError?.(message);
      }
    },
    [accept, maxSize, onUpload, onError]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleClick = () => {
    if (!disabled && progress === null) {
      inputRef.current?.click();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
        isDragging
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
          : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept.join(',')}
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        disabled={disabled}
      />

      {progress !== null ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
            {fileName}
          </p>
          <div
            className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Subiendo archivo: ${progress}%`}
          >
            <div
              className="bg-primary-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {progress === 100 ? '¡Completado!' : `${progress}%`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <svg
            className="mx-auto h-10 w-10 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6h.1a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-sm text-gray-600 dark:text-gray-300">{label}</p>
          <p className="text-xs text-gray-400">
            Máx. {formatSize(maxSize)}
          </p>
        </div>
      )}
    </div>
  );
};
