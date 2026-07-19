/**
 * Tipos relacionados con auditoría, respaldos y firma digital.
 * @validates Requirements 8.1, 9.1
 */

import type { UserRole } from './auth';

/** Tipo de acción auditada */
export type AuditAction = 'create' | 'read' | 'update' | 'delete';

/** Resultado de la acción */
export type AuditResult = 'success' | 'failure';

/** Registro de auditoría inmutable */
export interface AuditLog {
  id: string;
  userId: string;
  userRole: UserRole;
  action: AuditAction;
  entityTable: string;
  entityId: string;
  description?: string | null;
  ipAddress: string;
  result: AuditResult;
  metadata?: Record<string, unknown> | null;
  createdAt: string;             // ISO 8601
}

/** Estado del respaldo */
export type BackupStatus = 'success' | 'failed' | 'retrying';

/** Registro de respaldo */
export interface BackupRecord {
  id: string;
  executedAt: string;            // ISO 8601
  sizeBytes: number;
  filePath: string;
  checksum: string;              // SHA-256
  status: BackupStatus;
  errorMessage?: string | null;
  createdAt: string;             // ISO 8601
}

/** Registro de firma digital del paciente */
export interface SignatureRecord {
  id: string;
  patientId: string;
  signatureImagePath: string;
  documentType: string;          // e.g., 'privacy_notice'
  signedAt: string;              // ISO 8601
}
