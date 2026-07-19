/**
 * Tipos relacionados con citas y materiales de consulta.
 * @validates Requirements 5.1, 6.1
 */

/** Estado de la cita */
export type AppointmentStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

/** Cita médica */
export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentDate: string;       // ISO 8601 date (YYYY-MM-DD)
  appointmentTime: string;       // HH:mm format
  reason: string;
  status: AppointmentStatus;
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
}

/** Material requerido para una cita */
export interface AppointmentMaterial {
  id: string;
  appointmentId: string;
  materialName: string;
  quantity: number;
  notes?: string | null;
}
