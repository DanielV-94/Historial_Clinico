import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/shared/components';
import { api } from '@/services/api';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  entityTable: string;
  entityId: string;
  result: 'success' | 'failure';
  ipAddress: string;
}

interface AuditLogsResponse {
  data: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface AuditFilters {
  startDate: string;
  endDate: string;
  userId: string;
  action: string;
}

interface AuditLogViewerProps {
  className?: string;
}

const PAGE_SIZE = 20;

const ACTION_OPTIONS = [
  { value: '', label: 'Todas las acciones' },
  { value: 'CREATE', label: 'Crear' },
  { value: 'UPDATE', label: 'Actualizar' },
  { value: 'DELETE', label: 'Eliminar' },
  { value: 'LOGIN', label: 'Inicio de sesión' },
  { value: 'LOGOUT', label: 'Cierre de sesión' },
  { value: 'UPLOAD', label: 'Subir archivo' },
  { value: 'DOWNLOAD', label: 'Descargar' },
  { value: 'BACKUP', label: 'Respaldo' },
];

/**
 * AuditLogViewer — Vista de logs de auditoría con paginación y filtros.
 * Muestra fecha, usuario, acción, entidad y resultado.
 * Validates: Requirement 8.1
 */
export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ className = '' }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<AuditFilters>({
    startDate: '',
    endDate: '',
    userId: '',
    action: '',
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });

      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.action) params.append('action', filters.action);

      const response = await api.get<AuditLogsResponse>(`/audit/logs?${params.toString()}`);
      setLogs(response.data);
      setTotalPages(response.totalPages);
      setTotal(response.total);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilterChange = (field: keyof AuditFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(1); // Reset to first page on filter change
  };

  const handleClearFilters = () => {
    setFilters({ startDate: '', endDate: '', userId: '', action: '' });
    setPage(1);
  };

  const formatDate = (iso: string): string => {
    const date = new Date(iso);
    return date.toLocaleString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getResultBadge = (result: string) => {
    if (result === 'success') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
          Éxito
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
        Fallo
      </span>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      {/* Filters */}
      <GlassCard className="p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[140px]">
            <label
              htmlFor="filter-start-date"
              className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
            >
              Desde
            </label>
            <input
              id="filter-start-date"
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="flex-1 min-w-[140px]">
            <label
              htmlFor="filter-end-date"
              className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
            >
              Hasta
            </label>
            <input
              id="filter-end-date"
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="flex-1 min-w-[140px]">
            <label
              htmlFor="filter-user"
              className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
            >
              Usuario
            </label>
            <input
              id="filter-user"
              type="text"
              value={filters.userId}
              onChange={(e) => handleFilterChange('userId', e.target.value)}
              placeholder="Buscar usuario..."
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="flex-1 min-w-[140px]">
            <label
              htmlFor="filter-action"
              className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
            >
              Acción
            </label>
            <select
              id="filter-action"
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleClearFilters}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg transition-colors"
          >
            Limpiar
          </button>
        </div>
      </GlassCard>

      {/* Table */}
      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                  Fecha
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                  Usuario
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                  Acción
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                  Entidad
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                  Resultado
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    No se encontraron registros de auditoría.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      <div>
                        <span className="font-medium">{log.userName}</span>
                        <span className="ml-1 text-xs text-gray-400">({log.userRole})</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-mono text-xs">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      <span className="text-xs">
                        {log.entityTable}
                        {log.entityId && (
                          <span className="ml-1 text-gray-400">#{log.entityId.slice(0, 8)}</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">{getResultBadge(log.result)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de{' '}
              {total} registros
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Página anterior"
              >
                ←
              </button>
              <span className="px-3 py-1 text-sm text-gray-600 dark:text-gray-300">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Página siguiente"
              >
                →
              </button>
            </div>
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
};
