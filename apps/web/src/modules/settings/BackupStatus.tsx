import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/shared/components';
import { api } from '@/services/api';

export interface BackupRecord {
  id: string;
  createdAt: string;
  status: 'success' | 'failed' | 'retrying' | 'in_progress';
  sizeBytes: number;
  fileName: string;
  checksumSha256: string;
  triggeredBy: 'cron' | 'manual';
}

interface BackupStatusProps {
  className?: string;
}

/**
 * BackupStatus — Vista de estado de respaldos con listado, estado y trigger manual.
 * Validates: Requirement 9.1
 */
export const BackupStatus: React.FC<BackupStatusProps> = ({ className = '' }) => {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchBackups = useCallback(async () => {
    try {
      const data = await api.get<BackupRecord[]>('/backups');
      setBackups(data);
    } catch {
      setBackups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const handleTriggerBackup = async () => {
    setTriggering(true);
    setMessage(null);
    try {
      await api.post('/backups/trigger');
      setMessage({ type: 'success', text: 'Respaldo manual iniciado correctamente.' });
      // Refresh list after a short delay
      setTimeout(fetchBackups, 2000);
    } catch {
      setMessage({ type: 'error', text: 'Error al iniciar el respaldo manual.' });
    } finally {
      setTriggering(false);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
    if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const formatDate = (iso: string): string => {
    return new Date(iso).toLocaleString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: BackupRecord['status']) => {
    const styles: Record<BackupRecord['status'], string> = {
      success: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
      failed: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
      retrying: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
      in_progress: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    };

    const labels: Record<BackupRecord['status'], string> = {
      success: 'Completado',
      failed: 'Fallido',
      retrying: 'Reintentando',
      in_progress: 'En progreso',
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}
      >
        {status === 'in_progress' && (
          <span className="w-2 h-2 mr-1.5 rounded-full bg-blue-500 animate-pulse" />
        )}
        {labels[status]}
      </span>
    );
  };

  const getStatusIcon = (status: BackupRecord['status']) => {
    switch (status) {
      case 'success':
        return '✓';
      case 'failed':
        return '✗';
      case 'retrying':
        return '↻';
      case 'in_progress':
        return '⟳';
      default:
        return '•';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      {/* Header with manual trigger */}
      <GlassCard className="p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Respaldos del Sistema
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Respaldo automático mensual (día 1, 02:00 hrs). Retención: últimos 12.
            </p>
          </div>
          <button
            type="button"
            onClick={handleTriggerBackup}
            disabled={triggering}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium text-sm rounded-lg transition-colors focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            aria-label="Iniciar respaldo manual"
          >
            {triggering ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Iniciando...
              </>
            ) : (
              <>
                <span aria-hidden="true">💾</span>
                Respaldo Manual
              </>
            )}
          </button>
        </div>

        {message && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-3 px-3 py-2 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            }`}
            role="alert"
          >
            {message.text}
          </motion.div>
        )}
      </GlassCard>

      {/* Backup List */}
      <GlassCard className="overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : backups.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <p className="text-lg mb-1">No hay respaldos registrados</p>
            <p className="text-sm">Inicia un respaldo manual o espera al siguiente cron.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {backups.map((backup) => (
              <div
                key={backup.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
              >
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-sm">
                  {getStatusIcon(backup.status)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {backup.fileName}
                    </p>
                    {getStatusBadge(backup.status)}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {formatDate(backup.createdAt)} · {formatSize(backup.sizeBytes)} ·{' '}
                    <span className="capitalize">{backup.triggeredBy === 'cron' ? 'Automático' : 'Manual'}</span>
                  </p>
                </div>

                {backup.checksumSha256 && (
                  <div className="hidden md:block flex-shrink-0">
                    <p
                      className="text-xs text-gray-400 font-mono truncate max-w-[120px]"
                      title={backup.checksumSha256}
                    >
                      SHA: {backup.checksumSha256.slice(0, 12)}...
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
};
