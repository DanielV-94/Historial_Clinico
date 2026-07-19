import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition, GlassCard, SkeletonLoader } from '@/shared/components';
import { api } from '@/services/api';
import { DOCUMENTS_PAGE_SIZE } from '@historial/constants';
import type { FileMetadata } from '@historial/shared-types';
import { DocumentPreview } from './DocumentPreview';
import { DocumentUpload } from './DocumentUpload';

interface PaginatedDocumentsResponse {
  documents: FileMetadata[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface DocumentListProps {
  patientId: string;
}

/**
 * DocumentList — Lists PDF documents with pagination (20/page), chronological desc order.
 * Supports preview, upload, and delete with confirmation.
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
export const DocumentList: React.FC<DocumentListProps> = ({ patientId }) => {
  const [documents, setDocuments] = useState<FileMetadata[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Preview state
  const [previewDoc, setPreviewDoc] = useState<FileMetadata | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<FileMetadata | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDocuments = useCallback(
    async (page: number) => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.get<PaginatedDocumentsResponse>(
          `/patients/${patientId}/documents?page=${page}&pageSize=${DOCUMENTS_PAGE_SIZE}`
        );
        setDocuments(data.documents);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setCurrentPage(data.page);
      } catch {
        setError('No se pudieron cargar los documentos.');
        setDocuments([]);
      } finally {
        setLoading(false);
      }
    },
    [patientId]
  );

  useEffect(() => {
    fetchDocuments(1);
  }, [fetchDocuments]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      fetchDocuments(page);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      await api.delete(`/patients/${patientId}/documents/${deleteTarget.id}`);
      setDeleteTarget(null);
      // Refresh current page (or go back if last item on page)
      const refreshPage =
        documents.length === 1 && currentPage > 1
          ? currentPage - 1
          : currentPage;
      fetchDocuments(refreshPage);
    } catch {
      setError('No se pudo eliminar el documento.');
    } finally {
      setDeleting(false);
    }
  };

  const handleUploadSuccess = () => {
    // After upload, refresh to first page to see the new document at the top
    fetchDocuments(1);
  };

  const formatDate = (isoDate: string): string => {
    return new Date(isoDate).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
    if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const existingDocumentNames = documents.map((d) => d.originalName);

  return (
    <PageTransition transitionKey="document-list">
      <div className="space-y-6">
        {/* Upload section */}
        <DocumentUpload
          patientId={patientId}
          onUploadSuccess={handleUploadSuccess}
          existingDocumentNames={existingDocumentNames}
        />

        {/* Documents list */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Expediente digital
            </h3>
            {!loading && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {total} documento{total !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3">
                  <SkeletonLoader width="2.5rem" height="2.5rem" rounded delay={0} />
                  <div className="flex-1 space-y-2">
                    <SkeletonLoader width="60%" height="0.875rem" delay={0} />
                    <SkeletonLoader width="40%" height="0.75rem" delay={0} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && documents.length === 0 && !error && (
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No hay documentos en el expediente
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                Sube un PDF para comenzar
              </p>
            </div>
          )}

          {/* Document items */}
          {!loading && documents.length > 0 && (
            <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
              <AnimatePresence mode="popLayout">
                {documents.map((doc, index) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                    className="flex items-center gap-4 py-3 group"
                  >
                    {/* PDF icon */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-red-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>

                    {/* Document info */}
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        className="text-sm font-medium text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 truncate block text-left transition-colors"
                        title={`Ver: ${doc.originalName}`}
                      >
                        {doc.originalName}
                      </button>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(doc.uploadedAt)}
                        </span>
                        {doc.studyType && (
                          <>
                            <span className="text-xs text-gray-300 dark:text-gray-600">
                              •
                            </span>
                            <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                              {doc.studyType}
                            </span>
                          </>
                        )}
                        <span className="text-xs text-gray-300 dark:text-gray-600">
                          •
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {formatFileSize(doc.sizeBytes)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        className="p-2 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        aria-label={`Vista previa de ${doc.originalName}`}
                        title="Vista previa"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteTarget(doc)}
                        className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        aria-label={`Eliminar ${doc.originalName}`}
                        title="Eliminar"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100 dark:border-gray-700/50">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Página {currentPage} de {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Página anterior"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>

                {/* Page numbers */}
                {generatePageNumbers(currentPage, totalPages).map(
                  (pageNum, idx) =>
                    pageNum === null ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="px-2 text-gray-400 dark:text-gray-500"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`min-w-[2rem] h-8 rounded-lg text-sm font-medium transition-colors ${
                          pageNum === currentPage
                            ? 'bg-primary-600 text-white'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        aria-label={`Ir a página ${pageNum}`}
                        aria-current={pageNum === currentPage ? 'page' : undefined}
                      >
                        {pageNum}
                      </button>
                    )
                )}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Página siguiente"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </GlassCard>

        {/* PDF Preview modal */}
        <AnimatePresence>
          {previewDoc && (
            <DocumentPreview
              patientId={patientId}
              documentId={previewDoc.id}
              documentName={previewDoc.originalName}
              onClose={() => setPreviewDoc(null)}
            />
          )}
        </AnimatePresence>

        {/* Delete confirmation modal */}
        <AnimatePresence>
          {deleteTarget && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-modal-title"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
              >
                <h4
                  id="delete-modal-title"
                  className="text-lg font-semibold text-gray-900 dark:text-white mb-2"
                >
                  Eliminar documento
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  ¿Estás seguro de que deseas eliminar{' '}
                  <span className="font-medium">"{deleteTarget.originalName}"</span>?
                  Esta acción no se puede deshacer.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    disabled={deleting}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {deleting && (
                      <svg
                        className="w-4 h-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
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
                    )}
                    Eliminar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
};

/**
 * Generates a smart page number array with ellipsis for large page counts.
 */
function generatePageNumbers(
  current: number,
  total: number
): (number | null)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | null)[] = [];

  // Always show first page
  pages.push(1);

  if (current > 3) {
    pages.push(null); // ellipsis
  }

  // Pages around current
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push(null); // ellipsis
  }

  // Always show last page
  pages.push(total);

  return pages;
}
