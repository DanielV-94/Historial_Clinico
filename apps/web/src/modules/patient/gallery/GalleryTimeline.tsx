import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition, GlassCard, SkeletonLoader } from '@/shared/components';
import { api } from '@/services/api';
import type { FileMetadata } from '@historial/shared-types';
import { GalleryItem } from './GalleryItem';
import { GalleryUpload } from './GalleryUpload';
import { BeforeAfterSlider } from './BeforeAfterSlider';

interface GalleryResponse {
  items: FileMetadata[];
  total: number;
}

export interface GalleryTimelineProps {
  patientId: string;
}

/**
 * GalleryTimeline — Chronological timeline view of multimedia (photos/videos)
 * ordered by capture date descending. Supports upload, preview, and before/after comparison.
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6
 */
export const GalleryTimeline: React.FC<GalleryTimelineProps> = ({ patientId }) => {
  const [items, setItems] = useState<FileMetadata[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Comparison state
  const [selectedItems, setSelectedItems] = useState<FileMetadata[]>([]);
  const [showComparator, setShowComparator] = useState(false);

  // Preview state
  const [previewItem, setPreviewItem] = useState<FileMetadata | null>(null);

  const fetchGallery = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<GalleryResponse>(
        `/patients/${patientId}/gallery`
      );
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setError('No se pudo cargar la galería multimedia.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  const handleUploadSuccess = () => {
    fetchGallery();
  };

  const handleSelect = (item: FileMetadata) => {
    setSelectedItems((prev) => {
      const isAlreadySelected = prev.some((i) => i.id === item.id);
      if (isAlreadySelected) {
        return prev.filter((i) => i.id !== item.id);
      }
      // Max 2 selected for comparison
      if (prev.length >= 2) {
        return [prev[1], item];
      }
      return [...prev, item];
    });
  };

  const handleCompare = () => {
    if (selectedItems.length === 2) {
      setShowComparator(true);
    }
  };

  const handleCloseComparator = () => {
    setShowComparator(false);
  };

  const handlePreview = (item: FileMetadata) => {
    setPreviewItem(item);
  };

  const handleClosePreview = () => {
    setPreviewItem(null);
  };

  // Group items by month/year for timeline display
  const groupedItems = groupByMonth(items);

  return (
    <PageTransition transitionKey="gallery-timeline">
      <div className="space-y-6">
        {/* Upload section */}
        <GalleryUpload patientId={patientId} onUploadSuccess={handleUploadSuccess} />

        {/* Comparison bar */}
        <AnimatePresence>
          {selectedItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <GlassCard className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                    </svg>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {selectedItems.length} de 2 imágenes seleccionadas para comparar
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedItems([])}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      Limpiar
                    </button>
                    <button
                      onClick={handleCompare}
                      disabled={selectedItems.length < 2}
                      className="px-4 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Comparar
                    </button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gallery content */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Galería multimedia
            </h3>
            {!loading && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {total} archivo{total !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <SkeletonLoader width="100%" height="10rem" rounded delay={0} />
                  <SkeletonLoader width="60%" height="0.75rem" delay={0} />
                  <SkeletonLoader width="40%" height="0.75rem" delay={0} />
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && items.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg
                className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No hay fotos o videos en la galería
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                Sube una foto o video para comenzar
              </p>
            </div>
          )}

          {/* Timeline grouped by month */}
          {!loading && items.length > 0 && (
            <div className="space-y-8">
              {groupedItems.map(({ label, items: monthItems }) => (
                <div key={label}>
                  {/* Month label */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-2 h-2 rounded-full bg-primary-500" />
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      {label}
                    </h4>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {monthItems.length} archivo{monthItems.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Grid of items */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {monthItems.map((item, idx) => (
                      <GalleryItem
                        key={item.id}
                        item={item}
                        index={idx}
                        isSelected={selectedItems.some((s) => s.id === item.id)}
                        onPreview={handlePreview}
                        onSelect={handleSelect}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Before/After Comparator modal */}
        <AnimatePresence>
          {showComparator && selectedItems.length === 2 && (
            <BeforeAfterSlider
              beforeImage={getOlderImage(selectedItems[0], selectedItems[1])}
              afterImage={getNewerImage(selectedItems[0], selectedItems[1])}
              onClose={handleCloseComparator}
            />
          )}
        </AnimatePresence>

        {/* Full-screen preview modal */}
        <AnimatePresence>
          {previewItem && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
              role="dialog"
              aria-modal="true"
              aria-label={`Vista previa: ${previewItem.originalName}`}
              onClick={handleClosePreview}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="relative max-w-5xl max-h-[90vh] w-full"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close button */}
                <button
                  onClick={handleClosePreview}
                  className="absolute -top-10 right-0 p-2 text-white/70 hover:text-white transition-colors"
                  aria-label="Cerrar vista previa"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Media display */}
                {previewItem.category === 'video' ? (
                  <video
                    src={`/api/patients/${previewItem.patientId}/gallery/${previewItem.id}/preview`}
                    className="w-full max-h-[80vh] rounded-lg object-contain bg-black"
                    controls
                    autoPlay
                    aria-label={previewItem.originalName}
                  />
                ) : (
                  <img
                    src={`/api/patients/${previewItem.patientId}/gallery/${previewItem.id}/preview`}
                    alt={previewItem.notes || previewItem.originalName}
                    className="w-full max-h-[80vh] rounded-lg object-contain bg-black"
                  />
                )}

                {/* Metadata bar */}
                <div className="mt-3 flex items-center justify-between text-sm text-white/80">
                  <div className="flex items-center gap-3">
                    <span>{previewItem.originalName}</span>
                    {previewItem.anatomicalZone && (
                      <span className="px-2 py-0.5 rounded-full bg-white/20 text-xs">
                        {previewItem.anatomicalZone}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-white/60">
                    {previewItem.captureDate
                      ? new Date(previewItem.captureDate).toLocaleDateString('es-MX', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : ''}
                  </span>
                </div>
                {previewItem.notes && (
                  <p className="mt-1 text-xs text-white/60">{previewItem.notes}</p>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
};

// --- Helper functions ---

interface GroupedItems {
  label: string;
  items: FileMetadata[];
}

/**
 * Group gallery items by month/year from their capture date (descending order).
 */
function groupByMonth(items: FileMetadata[]): GroupedItems[] {
  const groups = new Map<string, FileMetadata[]>();

  for (const item of items) {
    const date = item.captureDate ? new Date(item.captureDate) : new Date(item.uploadedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' });

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }

  // Sort groups by key descending (most recent first)
  const sortedEntries = [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));

  return sortedEntries.map(([, groupItems]) => {
    const date = groupItems[0].captureDate
      ? new Date(groupItems[0].captureDate)
      : new Date(groupItems[0].uploadedAt);
    const label = date.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' });
    return { label, items: groupItems };
  });
}

/**
 * Returns the older image (earlier capture date) for the "before" slot.
 */
function getOlderImage(a: FileMetadata, b: FileMetadata): FileMetadata {
  const dateA = a.captureDate || a.uploadedAt;
  const dateB = b.captureDate || b.uploadedAt;
  return dateA <= dateB ? a : b;
}

/**
 * Returns the newer image (later capture date) for the "after" slot.
 */
function getNewerImage(a: FileMetadata, b: FileMetadata): FileMetadata {
  const dateA = a.captureDate || a.uploadedAt;
  const dateB = b.captureDate || b.uploadedAt;
  return dateA > dateB ? a : b;
}
