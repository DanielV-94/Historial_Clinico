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
export type { UserRole, RolePermissions, User } from './auth';
export type { PatientSex, BloodType, Patient, Allergy, PreviousSurgery, } from './patient';
export type { ClinicalNote, PrescriptionStatus, Prescription, } from './clinical';
export type { AppointmentStatus, Appointment, AppointmentMaterial, } from './appointment';
export type { FileCategory, FileMetadata } from './file';
export type { AuditAction, AuditResult, AuditLog, BackupStatus, BackupRecord, SignatureRecord, } from './audit';
export type { ThemeConfig, LetterheadFieldConfig, LetterheadConfig, Clinic, } from './clinic';
//# sourceMappingURL=index.d.ts.map