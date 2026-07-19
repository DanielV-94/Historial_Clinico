import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { FileMetadata } from '@historial/shared-types';

export interface BeforeAfterSliderProps {
  /** "Before" image (older photo) */
  beforeImage: FileMetadata;
  /** "After" image (newer photo) */
  afterImage: FileMetadata;
  /** Callback to close the comparator */
  onClose: () => void;
}

/**
 * BeforeAfterSlider — Interactive slider comparing two images side-by-side
 * with a draggable divider. The before image is shown on the left, after on the right.
 * Validates: Requirement 3.3
 */
export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
  beforeImage,
  afterImage,
  onClose,
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const beforeUrl = `/api/patients/${beforeImage.patientId}/gallery/${beforeImage.id}/preview`;
  const afterUrl = `/api/patients/${afterImage.patientId}/gallery/${afterImage.id}/preview`;

  const formatDate = (isoDate: string | null | undefined): string => {
    if (!isoDate) return 'Sin fecha';
    return new Date(isoDate).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const updatePosition = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPosition(percentage);
    },
    []
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleTouchStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        updatePosition(e.clientX);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches[0]) {
        updatePosition(e.touches[0].clientX);
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, updatePosition]);

  // Handle keyboard for accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = 2;
    if (e.key === 'ArrowLeft') {
      setSliderPosition((prev) => Math.max(0, prev - step));
    } else if (e.key === 'ArrowRight') {
      setSliderPosition((prev) => Math.min(100, prev + step));
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Comparador antes y después"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="relative w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Antes</span>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {formatDate(beforeImage.captureDate)}
              </p>
              {beforeImage.anatomicalZone && (
                <p className="text-xs text-primary-600 dark:text-primary-400">
                  {beforeImage.anatomicalZone}
                </p>
              )}
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <div className="text-center">
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Después</span>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {formatDate(afterImage.captureDate)}
              </p>
              {afterImage.anatomicalZone && (
                <p className="text-xs text-primary-600 dark:text-primary-400">
                  {afterImage.anatomicalZone}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Cerrar comparador"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Slider comparison area */}
        <div
          ref={containerRef}
          className="relative w-full aspect-[16/10] overflow-hidden select-none cursor-col-resize"
          onMouseDown={(e) => updatePosition(e.clientX)}
          onTouchStart={(e) => {
            if (e.touches[0]) updatePosition(e.touches[0].clientX);
          }}
          role="slider"
          aria-label="Deslizador de comparación antes/después"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(sliderPosition)}
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          {/* After image (full background) */}
          <img
            src={afterUrl}
            alt={`Después: ${afterImage.notes || afterImage.originalName}`}
            className="absolute inset-0 w-full h-full object-contain bg-gray-50 dark:bg-gray-800"
          />

          {/* Before image (clipped by slider position) */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ width: `${sliderPosition}%` }}
          >
            <img
              src={beforeUrl}
              alt={`Antes: ${beforeImage.notes || beforeImage.originalName}`}
              className="absolute inset-0 w-full h-full object-contain bg-gray-50 dark:bg-gray-800"
              style={{ minWidth: containerRef.current?.offsetWidth || '100%' }}
            />
          </div>

          {/* Slider divider line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
            style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
          >
            {/* Draggable handle */}
            <div
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-xl border-2 border-gray-200 flex items-center justify-center cursor-col-resize transition-transform ${
                isDragging ? 'scale-110' : 'hover:scale-105'
              }`}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
            </div>
          </div>

          {/* Labels */}
          <div className="absolute bottom-3 left-3 px-2 py-1 rounded-md bg-black/60 text-white text-xs font-medium">
            Antes
          </div>
          <div className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-black/60 text-white text-xs font-medium">
            Después
          </div>
        </div>

        {/* Footer with instructions */}
        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-700/50 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Arrastra el deslizador o usa las teclas ← → para comparar
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};
