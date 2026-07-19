import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/shared/components';
import { api } from '@/services/api';

const MIN_CONTENT_LENGTH = 1;
const MAX_CONTENT_LENGTH = 10_000;

export interface NoteEditorProps {
  patientId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * NoteEditor — Editor for creating clinical notes with validation.
 * Content must be between 1 and 10,000 characters.
 * Shows inline error messages for validation failures.
 * Validates: Requirements 4.1, 4.2
 */
export const NoteEditor: React.FC<NoteEditorProps> = ({
  patientId,
  onSuccess,
  onCancel,
}) => {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const charCount = content.length;
  const isOverLimit = charCount > MAX_CONTENT_LENGTH;
  const isEmpty = content.trim().length === 0;

  const validate = useCallback((): string | null => {
    const trimmed = content.trim();
    if (trimmed.length < MIN_CONTENT_LENGTH) {
      return 'La nota no puede estar vacía.';
    }
    if (trimmed.length > MAX_CONTENT_LENGTH) {
      return `La nota no puede exceder ${MAX_CONTENT_LENGTH.toLocaleString()} caracteres.`;
    }
    return null;
  }, [content]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await api.post(`/patients/${patientId}/notes`, {
        content: content.trim(),
      });
      onSuccess();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || 'No se pudo guardar la nota. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    // Clear error on typing
    if (error) setError(null);
  };

  return (
    <GlassCard className="p-6">
      <form onSubmit={handleSubmit}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Nueva nota de evolución
          </h4>
          <span
            className={`text-xs font-medium ${
              isOverLimit
                ? 'text-red-500'
                : charCount > MAX_CONTENT_LENGTH * 0.9
                ? 'text-amber-500'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {charCount.toLocaleString()} / {MAX_CONTENT_LENGTH.toLocaleString()}
          </span>
        </div>

        {/* Textarea */}
        <textarea
          value={content}
          onChange={handleContentChange}
          placeholder="Escribe la nota de evolución del paciente..."
          rows={6}
          className={`w-full px-4 py-3 rounded-xl border text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 bg-white/50 dark:bg-gray-900/50 focus:outline-none focus:ring-2 resize-y transition-colors ${
            error || isOverLimit
              ? 'border-red-300 dark:border-red-700 focus:ring-red-500/30'
              : 'border-gray-200 dark:border-gray-700 focus:ring-primary-500/30 focus:border-primary-400'
          }`}
          aria-label="Contenido de la nota de evolución"
          aria-invalid={!!error || isOverLimit}
          aria-describedby={error ? 'note-error' : undefined}
          disabled={saving}
        />

        {/* Error message */}
        {error && (
          <motion.p
            id="note-error"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-xs text-red-500 dark:text-red-400"
            role="alert"
          >
            {error}
          </motion.p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 mt-4 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || isEmpty || isOverLimit}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Guardar nota
          </button>
        </div>
      </form>
    </GlassCard>
  );
};
