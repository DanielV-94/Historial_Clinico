import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/shared/components';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';

export interface PrescriptionItem {
  id: string;
  patientId: string;
  doctorId: string;
  assignedTo: string;
  content: string;
  status: string;
  readAt: string | null;
  completedAt: string | null;
  createdAt: string;
  patient?: { fullName: string };
  doctor?: { fullName: string };
}

export interface PrescriptionInboxProps {
  prescriptions: PrescriptionItem[];
  isLoading?: boolean;
  onMarkCompleted?: (id: string) => void;
  onPrintPdf?: (id: string) => void;
}

/**
 * PrescriptionInbox — Shows prescriptions sent by doctors, ordered by date desc.
 * Supports read/unread states, mark as completed (archive), and PDF print.
 *
 * @validates Requirements 6.3, 6.4, 6.5, 6.6
 */
export const PrescriptionInbox: React.FC<PrescriptionInboxProps> = ({
  prescriptions,
  isLoading = false,
  onMarkCompleted,
  onPrintPdf,
}) => {
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const handleComplete = async (id: string) => {
    setCompletingId(id);
    try {
      await api.patch(`/prescriptions/${id}/complete`);
      onMarkCompleted?.(id);
    } catch (error) {
      console.error('Error marking prescription as completed:', error);
    } finally {
      setCompletingId(null);
    }
  };

  const handlePrint = async (id: string) => {
    setPrintingId(id);
    try {
      // Fetch PDF as blob and open in a new window for printing
      const response = await fetch(`/api/prescriptions/${id}/pdf`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al generar PDF');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');

      if (printWindow) {
        printWindow.addEventListener('load', () => {
          printWindow.print();
        });
      }

      onPrintPdf?.(id);
    } catch (error) {
      console.error('Error printing prescription PDF:', error);
    } finally {
      setPrintingId(null);
    }
  };

  if (isLoading) {
    return <InboxSkeleton />;
  }

  if (prescriptions.length === 0) {
    return (
      <GlassCard className="p-6">
        <div className="text-center py-8">
          <span className="text-4xl mb-3 block">📋</span>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
            Bandeja vacía
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            No hay prescripciones pendientes
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <span>📋</span>
        Bandeja de Prescripciones ({prescriptions.length})
      </h2>

      <AnimatePresence>
        <div className="space-y-3">
          {prescriptions.map((prescription, index) => {
            const isUnread = !prescription.readAt;
            const isCompleting = completingId === prescription.id;
            const isPrinting = printingId === prescription.id;

            return (
              <motion.div
                key={prescription.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12, height: 0 }}
                transition={{ delay: index * 0.04, duration: 0.3 }}
                layout
              >
                <GlassCard
                  className={`p-4 ${
                    isUnread
                      ? 'border-l-4 border-l-primary-500 dark:border-l-primary-400'
                      : ''
                  }`}
                >
                  <div className="flex flex-col gap-3">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {prescription.patient?.fullName || 'Paciente'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Dr. {prescription.doctor?.fullName || 'Doctor'} •{' '}
                          {formatDateTime(prescription.createdAt)}
                        </p>
                      </div>

                      <PrescriptionStatusBadge status={prescription.status} />
                    </div>

                    {/* Content */}
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line line-clamp-3">
                      {prescription.content}
                    </p>

                    {/* Actions */}
                    {prescription.status !== 'completed' && (
                      <div className="flex items-center gap-2 pt-1">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handlePrint(prescription.id)}
                          disabled={isPrinting}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50"
                          aria-label={`Imprimir prescripción de ${prescription.patient?.fullName}`}
                        >
                          {isPrinting ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <PrintIcon className="w-4 h-4" />
                          )}
                          Imprimir
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleComplete(prescription.id)}
                          disabled={isCompleting}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 transition-colors disabled:opacity-50"
                          aria-label={`Marcar como completada prescripción de ${prescription.patient?.fullName}`}
                        >
                          {isCompleting ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <CheckIcon className="w-4 h-4" />
                          )}
                          Completada
                        </motion.button>
                      </div>
                    )}
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </AnimatePresence>
    </div>
  );
};

function PrescriptionStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending: {
      label: 'Pendiente',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    },
    read: {
      label: 'Leída',
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    },
    completed: {
      label: 'Completada',
      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    },
  };

  const c = config[status] || {
    label: status,
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${c.className}`}>
      {c.label}
    </span>
  );
}

function formatDateTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

function getToken(): string {
  return useAuthStore.getState().token || '';
}

function PrintIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <svg
      className={`animate-spin ${sizeClass}`}
      xmlns="http://www.w3.org/2000/svg"
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
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function InboxSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-56 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      {[1, 2, 3, 4].map((i) => (
        <GlassCard key={i} className="p-4">
          <div className="space-y-3">
            <div className="flex justify-between">
              <div className="space-y-2">
                <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
              <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
            </div>
            <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
