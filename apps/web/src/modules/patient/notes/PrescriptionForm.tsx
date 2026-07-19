import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/shared/components';
import { api } from '@/services/api';

export interface PrescriptionFormProps {
  patientId: string;
  patientName?: string;
}

type FeedbackState = null | { type: 'success'; message: string } | { type: 'error'; message: string };

/**
 * PrescriptionForm — Creates a prescription and auto-sends it to the assistant's inbox.
 * Shows green confirmation on success, red error with retry on failure.
 * Validates: Requirements 4.3, 4.5
 */
export const PrescriptionForm: React.FC<PrescriptionFormProps> = ({
  patientId,
  patientName,
}) => {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [showForm, setShowForm] = useState(false);

  const isEmpty = content.trim().length === 0;

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      if (isEmpty) return;

      try {
        setSending(true);
        setFeedback(null);
        await api.post('/prescriptions', {
          patientId,
          content: content.trim(),
        });
        setFeedback({
          type: 'success',
          message: 'Prescripción enviada al asistente correctamente.',
        });
        setContent('');
        // Auto-hide success after 4 seconds
        setTimeout(() => setFeedback(null), 4000);
      } catch (err: unknown) {
        const apiErr = err as { message?: string };
        setFeedback({
          type: 'error',
          message: apiErr.message || 'No se pudo enviar la prescripción. Intenta de nuevo.',
        });
      } finally {
        setSending(false);
      }
    },
    [patientId, content, isEmpty]
  );

  const handleRetry = () => {
    handleSubmit();
  };

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:border-emerald-400 hover:text-emerald-700 dark:hover:border-emerald-500 dark:hover:text-emerald-300 transition-colors"
        aria-label="Crear nueva prescripción"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="text-sm font-medium">Nueva prescripción</span>
      </button>
    );
  }

  return (
    <GlassCard className="p-6">
      <form onSubmit={handleSubmit}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Nueva prescripción
          </h4>
          {patientName && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Paciente: {patientName}
            </span>
          )}
        </div>

        {/* Content textarea */}
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (feedback) setFeedback(null);
          }}
          placeholder="Escribe la prescripción o indicación..."
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 bg-white/50 dark:bg-gray-900/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 resize-y transition-colors"
          aria-label="Contenido de la prescripción"
          disabled={sending}
        />

        {/* Feedback */}
        <AnimatePresence mode="wait">
          {feedback && (
            <motion.div
              key={feedback.type}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className={`mt-3 p-3 rounded-lg text-sm flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
              }`}
              role="alert"
            >
              {feedback.type === 'success' ? (
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              <span className="flex-1">{feedback.message}</span>
              {feedback.type === 'error' && (
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={sending}
                  className="ml-2 px-3 py-1 text-xs font-medium bg-red-100 dark:bg-red-800/40 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800/60 transition-colors disabled:opacity-50"
                >
                  Reintentar
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info about auto-send */}
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          La prescripción se enviará automáticamente a la bandeja del asistente.
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-4 justify-end">
          <button
            type="button"
            onClick={() => {
              setShowForm(false);
              setContent('');
              setFeedback(null);
            }}
            disabled={sending}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={sending || isEmpty}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {sending && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Enviar prescripción
          </button>
        </div>
      </form>
    </GlassCard>
  );
};
