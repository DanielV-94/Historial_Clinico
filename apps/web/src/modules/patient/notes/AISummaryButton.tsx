import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/shared/components';
import { api } from '@/services/api';

interface AISummarySection {
  title: string;
  items: string[];
}

interface AISummaryResponse {
  summary: {
    diagnosticos: string[];
    tratamientos: string[];
    alergias: string[];
    recomendaciones: string[];
  };
  generatedAt: string;
}

export interface AISummaryButtonProps {
  patientId: string;
}

/**
 * AISummaryButton — Triggers AI clinical summary generation.
 * Displays loading spinner while generating, then shows structured result
 * with sections: diagnósticos, tratamientos, alergias, recomendaciones.
 * Validates: Requirements 4.6, 14.1
 */
export const AISummaryButton: React.FC<AISummaryButtonProps> = ({ patientId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AISummarySection[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError(null);
      setSummary(null);

      const data = await api.post<AISummaryResponse>(`/ai/summary/${patientId}`);

      const sections: AISummarySection[] = [
        { title: 'Diagnósticos', items: data.summary.diagnosticos },
        { title: 'Tratamientos', items: data.summary.tratamientos },
        { title: 'Alergias', items: data.summary.alergias },
        { title: 'Recomendaciones', items: data.summary.recomendaciones },
      ];

      setSummary(sections);
      setGeneratedAt(data.generatedAt);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || 'No se pudo generar el resumen clínico. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setSummary(null);
    setGeneratedAt(null);
    setError(null);
  };

  const sectionIcons: Record<string, React.ReactNode> = {
    'Diagnósticos': (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    'Tratamientos': (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
    'Alergias': (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    'Recomendaciones': (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  };

  return (
    <div className="space-y-4">
      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-sm font-medium shadow-lg shadow-violet-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        aria-label="Generar resumen clínico con IA"
      >
        {loading ? (
          <>
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Generando resumen clínico...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Generar Resumen Clínico</span>
          </>
        )}
      </button>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400 flex items-center gap-2"
            role="alert"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="flex-1">{error}</span>
            <button
              onClick={handleGenerate}
              className="text-xs font-medium px-2 py-1 bg-red-100 dark:bg-red-800/40 rounded hover:bg-red-200 dark:hover:bg-red-800/60 transition-colors"
            >
              Reintentar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary result */}
      <AnimatePresence>
        {summary && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3 }}
          >
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Resumen Clínico IA
                    </h4>
                    {generatedAt && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Generado: {new Date(generatedAt).toLocaleString('es-MX')}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleDismiss}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Cerrar resumen"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Summary sections */}
              <div className="space-y-4">
                {summary.map((section) => (
                  <div key={section.title}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-violet-600 dark:text-violet-400">
                        {sectionIcons[section.title] || null}
                      </span>
                      <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                        {section.title}
                      </h5>
                    </div>
                    {section.items.length > 0 ? (
                      <ul className="space-y-1 pl-6">
                        {section.items.map((item, idx) => (
                          <li
                            key={idx}
                            className="text-sm text-gray-700 dark:text-gray-300 list-disc"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-gray-500 pl-6 italic">
                        Sin datos registrados
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
