import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/shared/components';
import { api } from '@/services/api';

interface DiskSpaceInfo {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercent: number;
}

interface DiskSpaceIndicatorProps {
  className?: string;
}

const REFRESH_INTERVAL_MS = 60_000; // Refresh every 60 seconds

/**
 * DiskSpaceIndicator — Indicador de espacio en disco disponible.
 * Muestra barra de progreso con espacio usado vs total.
 * Validates: Requirement 12.4
 */
export const DiskSpaceIndicator: React.FC<DiskSpaceIndicatorProps> = ({ className = '' }) => {
  const [diskInfo, setDiskInfo] = useState<DiskSpaceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchDiskSpace = async () => {
      try {
        const data = await api.get<DiskSpaceInfo>('/system/disk-space');
        setDiskInfo(data);
        setError(false);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchDiskSpace();
    const interval = setInterval(fetchDiskSpace, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const formatSize = (bytes: number): string => {
    if (bytes >= 1_000_000_000_000) return `${(bytes / 1_000_000_000_000).toFixed(2)} TB`;
    if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(0)} MB`;
    return `${(bytes / 1_000).toFixed(0)} KB`;
  };

  const getBarColor = (percent: number): string => {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusColor = (percent: number): string => {
    if (percent >= 90) return 'text-red-600 dark:text-red-400';
    if (percent >= 75) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getStatusLabel = (percent: number): string => {
    if (percent >= 90) return 'Espacio crítico';
    if (percent >= 75) return 'Espacio limitado';
    return 'Espacio disponible';
  };

  if (loading) {
    return (
      <GlassCard className={`p-4 ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </GlassCard>
    );
  }

  if (error || !diskInfo) {
    return (
      <GlassCard className={`p-4 ${className}`}>
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <span aria-hidden="true">⚠️</span>
          <p className="text-sm">No se pudo obtener información de espacio en disco.</p>
        </div>
      </GlassCard>
    );
  }

  const { totalBytes, usedBytes, freeBytes, usedPercent } = diskInfo;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <GlassCard className={`p-5 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            Espacio en Disco
          </h3>
          <span className={`text-sm font-medium ${getStatusColor(usedPercent)}`}>
            {getStatusLabel(usedPercent)}
          </span>
        </div>

        {/* Progress Bar */}
        <div
          className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={usedPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Espacio en disco usado: ${usedPercent}%`}
        >
          <motion.div
            className={`h-full rounded-full ${getBarColor(usedPercent)}`}
            initial={{ width: 0 }}
            animate={{ width: `${usedPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>

        {/* Stats */}
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-300">
            <span className="font-medium">{formatSize(usedBytes)}</span> usado de{' '}
            <span className="font-medium">{formatSize(totalBytes)}</span>
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            {formatSize(freeBytes)} libre
          </span>
        </div>

        {/* Percentage */}
        <div className="mt-2 text-center">
          <span className={`text-2xl font-bold ${getStatusColor(usedPercent)}`}>
            {usedPercent.toFixed(1)}%
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">utilizado</span>
        </div>

        {/* Warning for high usage */}
        {usedPercent >= 75 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`mt-3 px-3 py-2 rounded-lg text-xs ${
              usedPercent >= 90
                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
            }`}
            role="alert"
          >
            {usedPercent >= 90
              ? '⚠️ El espacio en disco está casi lleno. Libera espacio o amplía el almacenamiento para evitar interrupciones.'
              : '💡 El espacio en disco se está reduciendo. Considera programar una limpieza.'}
          </motion.div>
        )}
      </GlassCard>
    </motion.div>
  );
};
