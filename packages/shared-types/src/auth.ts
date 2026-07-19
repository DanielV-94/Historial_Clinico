/**
 * Tipos relacionados con autenticación, roles y permisos del sistema.
 * @validates Requirements 13.2
 */

/** Roles del sistema */
export type UserRole = 'doctor' | 'assistant' | 'admin' | 'kiosk';

/** Permisos por módulo */
export interface RolePermissions {
  patient: { read: boolean; write: boolean };
  dashboard_doctor: { read: boolean };
  dashboard_assistant: { read: boolean };
  kiosk: { read: boolean; write: boolean };
  whitelabel: { read: boolean; write: boolean };
  audit: { read: boolean };
  ai: { read: boolean };
}

/** Usuario del sistema */
export interface User {
  id: string;
  username: string;
  passwordHash?: string;
  role: UserRole;
  fullName: string;
  email: string;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil?: string | null;   // ISO 8601
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
}
