import React from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/shared/components';
import type { FileMetadata } from '@historial/shared-types';

export interface GalleryItemProps {
  item: FileMetadata;
  /** Whether this item is selected for comparison */
  isSelected?: boolean;
  /** Callback when item is clicked for preview */
  onPreview?: (item: FileMetadata) => void;
  /** Callback when item is selected for comparison */
  onSelect?: (item: FileMetadata) => void;
  /** Animation delay index */
  index?: number;
}

/**
 * GalleryItem — Single multimedia gallery entry showing thumbnail, metadata, and actions.
 * Displays: capture date, anatomical zone, observations.
 * Validates: Requirements 3.1, 3.2
 */
export const GalleryItem: React.FC<GalleryItemProps> = ({
  item,
  isSelected = false,
  onPreview,
  onSelect,
  index = 0,
}) => {
  const isVideo = item.category === 'video';
  const previewUrl = `/api/patients/${item.patientId}/gallery/${item.id}/preview`;

  const formatDate = (isoDate: string | null | undefined): string => {
    if (!isoDate) return 'Sin fecha';
    return new Date(isoDate).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatSize = (bytes: number): string => {
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
    if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
    >
      <GlassCard
        className={`overflow-hidden transition-all duration-200 ${
          isSelected
            ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-900'
            : 'hover:shadow-lg'
        }`}
      >
        {/* Thumbnail / Preview */}
        <div className="relative aspect-[4/3] bg-gray-100 dark:bg-gray-800 overflow-hidden group">
          {isVideo ? (
            <video
              src={previewUrl}
              className="w-full h-full object-cover"
              muted
              preload="metadata"
              aria-label={`Video: ${item.originalName}`}
            />
          ) : (
            <img
              src={previewUrl}
              alt={item.notes || item.originalName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          )}

          {/* Video badge */}
          {isVideo && (
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-xs font-medium flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.5 5.5v9l7-4.5-7-4.5z" />
              </svg>
              Video
            </div>
          )}

          {/* Watermark indicator */}
          {item.hasWatermark && (
            <div className="absolute top-2 right-2 p-1 rounded-md bg-black/40 text-white" title="Con marca de agua">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          )}

          {/* Hover overlay with actions */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button
              onClick={() => onPreview?.(item)}
              className="p-2 rounded-full bg-white/90 text-gray-800 hover:bg-white transition-colors shadow-md"
              aria-label={`Ver ${item.originalName}`}
              title="Vista previa"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            {!isVideo && (
              <button
                onClick={() => onSelect?.(item)}
                className={`p-2 rounded-full transition-colors shadow-md ${
                  isSelected
                    ? 'bg-primary-500 text-white hover:bg-primary-600'
                    : 'bg-white/90 text-gray-800 hover:bg-white'
                }`}
                aria-label={isSelected ? 'Deseleccionar para comparar' : 'Seleccionar para comparar'}
                title={isSelected ? 'Quitar de comparación' : 'Comparar'}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-900 dark:text-white truncate">
              {formatDate(item.captureDate)}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {formatSize(item.sizeBytes)}
            </span>
          </div>

          {item.anatomicalZone && (
            <span className="inline-block px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/30 text-xs font-medium text-primary-700 dark:text-primary-300">
              {item.anatomicalZone}
            </span>
          )}

          {item.notes && (
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
              {item.notes}
            </p>
          )}
        </div>
      </GlassCard>
    </motion.div>
  );
};
