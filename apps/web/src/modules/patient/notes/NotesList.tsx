import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard, SkeletonLoader } from '@/shared/components';
import { api } from '@/services/api';
import type { ClinicalNote } from '@historial/shared-types';
import { NoteEditor } from './NoteEditor';

interface PaginatedNotesResponse {
  notes: ClinicalNote[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface NotesListProps {
  patientId: string;
}

/**
 * NotesList — Lists clinical notes in descending chronological order.
 * Shows date, time, and author for each note. Supports creation via NoteEditor.
 * Validates: Requirements 4.1, 4.2, 4.4
 */
export const NotesList: React.FC<NotesListProps> = ({ patientId }) => {
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const fetchNotes = useCallback(
    async (page: number) => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.get<PaginatedNotesResponse>(
          `/patients/${patientId}/notes?page=${page}&pageSize=20`
        );
        setNotes(data.notes);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setCurrentPage(data.page);
      } catch {
        setError('No se pudieron cargar las notas clínicas.');
        setNotes([]);
      } finally {
        setLoading(false);
      }
    },
    [patientId]
  );

  useEffect(() => {
    fetchNotes(1);
  }, [fetchNotes]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      fetchNotes(page);
    }
  };

  const handleNoteCreated = () => {
    setShowEditor(false);
    fetchNotes(1);
  };

  const formatDate = (isoDate: string): string => {
    return new Date(isoDate).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (isoDate: string): string => {
    return new Date(isoDate).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* New Note Button / Editor */}
      <AnimatePresence mode="wait">
        {showEditor ? (
          <motion.div
            key="editor"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <NoteEditor
              patientId={patientId}
              onSuccess={handleNoteCreated}
              onCancel={() => setShowEditor(false)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="add-button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              onClick={() => setShowEditor(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 dark:hover:border-primary-500 dark:hover:text-primary-400 transition-colors"
              aria-label="Agregar nueva nota de evolución"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm font-medium">Nueva nota de evolución</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes List */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Notas de evolución
          </h3>
          {!loading && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {total} nota{total !== 1 ? 's' : ''}
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
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 rounded-xl bg-gray-50/50 dark:bg-gray-800/30">
                <div className="flex items-center gap-3 mb-2">
                  <SkeletonLoader width="5rem" height="0.75rem" delay={0} />
                  <SkeletonLoader width="3rem" height="0.75rem" delay={0} />
                  <SkeletonLoader width="6rem" height="0.75rem" delay={0} />
                </div>
                <SkeletonLoader width="100%" height="2.5rem" delay={0} />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && notes.length === 0 && !error && (
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
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No hay notas de evolución
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
              Agrega una nota para comenzar el registro clínico
            </p>
          </div>
        )}

        {/* Note items */}
        {!loading && notes.length > 0 && (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {notes.map((note, index) => (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  className="p-4 rounded-xl bg-gray-50/50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-700/50"
                >
                  {/* Note header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {formatDate(note.createdAt)}
                    </span>
                    <span className="text-xs text-gray-300 dark:text-gray-600">•</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTime(note.createdAt)}
                    </span>
                    <span className="text-xs text-gray-300 dark:text-gray-600">•</span>
                    <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
                      Dr. {note.authorId}
                    </span>
                  </div>

                  {/* Note content */}
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {note.content}
                  </p>
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
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Página siguiente"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
};
