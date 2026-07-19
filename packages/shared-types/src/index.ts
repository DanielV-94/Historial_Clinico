/**
 * @historial/shared-types
 * Interfaces TypeScript compartidas del Sistema de Gestión Clínica.
 *
 * Organización:
 * - auth.ts       → UserRole, RolePermissions, User
 * - patient.ts    → Patient, Allergy, PreviousSurgery
 * - clinical.ts   → ClinicalNote, Prescription
 * - appointment.ts → Appointment, AppointmentMaterial
 * - file.ts       → FileMetadata
 * - audit.ts      → AuditLog, BackupRecord, SignatureRecord
 * - clinic.ts     → ThemeConfig, Clinic, LetterheadConfig
 */

// Auth & Roles
export type { UserRole, RolePermissions, User } from './auth';

// Patient
export type {
  PatientSex,
  BloodType,
  Patient,
  Allergy,
  PreviousSurgery,
} from './patient';

// Clinical Notes & Prescriptions
export type {
  ClinicalNote,
  PrescriptionStatus,
  Prescription,
} from './clinical';

// Appointments
export type {
  AppointmentStatus,
  Appointment,
  AppointmentMaterial,
} from './appointment';

// File Management
export type { FileCategory, FileMetadata } from './file';

// Audit, Backup & Signatures
export type {
  AuditAction,
  AuditResult,
  AuditLog,
  BackupStatus,
  BackupRecord,
  SignatureRecord,
} from './audit';

// Clinic & Theme
export type {
  ThemeConfig,
  LetterheadFieldConfig,
  LetterheadConfig,
  Clinic,
} from './clinic';
