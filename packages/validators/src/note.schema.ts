import { z } from 'zod';

/**
 * Schema de validación para notas clínicas.
 * Validates: Requirements 4.1, 4.2
 */

/** Longitud mínima y máxima del contenido */
export const NOTE_MIN_LENGTH = 1;
export const NOTE_MAX_LENGTH = 10_000;

/** Schema de contenido de nota clínica */
export const clinicalNoteContentSchema = z
  .string({ required_error: 'El contenido de la nota es obligatorio' })
  .min(NOTE_MIN_LENGTH, 'La nota clínica no puede estar vacía')
  .max(NOTE_MAX_LENGTH, `La nota clínica no puede exceder ${NOTE_MAX_LENGTH.toLocaleString()} caracteres`);

/** Schema completo de creación de nota clínica */
export const createClinicalNoteSchema = z.object({
  content: clinicalNoteContentSchema,
  patientId: z.string().uuid('El ID del paciente debe ser un UUID válido'),
});

/** Tipos inferidos */
export type ClinicalNoteContentInput = z.infer<typeof clinicalNoteContentSchema>;
export type CreateClinicalNoteInput = z.infer<typeof createClinicalNoteSchema>;
