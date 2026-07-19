/**
 * Tipos relacionados con notas clínicas y prescripciones.
 * @validates Requirements 4.1, 4.2, 4.3
 */

/** Nota clínica / nota de evolución */
export interface ClinicalNote {
  id: string;
  patientId: string;
  authorId: string;
  content: string;               // max 10,000 chars
  createdAt: string;             // ISO 8601
}

/** Estado de la prescripción */
export type PrescriptionStatus = 'pending' | 'read' | 'completed';

/** Prescripción o indicación del doctor */
export interface Prescription {
  id: string;
  patientId: string;
  doctorId: string;
  assignedTo: string;            // ID del asistente
  content: string;
  status: PrescriptionStatus;
  readAt?: string | null;        // ISO 8601
  completedAt?: string | null;   // ISO 8601
  createdAt: string;             // ISO 8601
}
