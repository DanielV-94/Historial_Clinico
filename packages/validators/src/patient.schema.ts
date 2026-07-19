import { z } from 'zod';

/**
 * Schema de validación para datos de paciente.
 * Validates: Requirements 1.3, 1.4, 7.4
 */

/** Sexo biológico del paciente */
export const sexoEnum = z.enum(['M', 'F', 'O']);

/** Validación de alergia individual (max 200 chars) */
export const allergySchema = z
  .string()
  .min(1, 'La alergia no puede estar vacía')
  .max(200, 'La alergia no puede exceder 200 caracteres');

/** Validación de cirugía previa */
export const previousSurgerySchema = z.object({
  name: z.string().min(1, 'El nombre de la cirugía es obligatorio'),
  date: z.coerce.date({ required_error: 'La fecha de la cirugía es obligatoria' }),
});

/** Validación de foto de perfil */
export const profilePhotoSchema = z.object({
  mimeType: z.enum(['image/jpeg', 'image/png'], {
    errorMap: () => ({ message: 'La foto de perfil debe ser JPEG o PNG' }),
  }),
  sizeBytes: z
    .number()
    .max(5 * 1024 * 1024, 'La foto de perfil no puede exceder 5 MB'),
});

/** Schema principal de paciente */
export const patientSchema = z.object({
  fullName: z
    .string({ required_error: 'El nombre completo es obligatorio' })
    .min(1, 'El nombre completo no puede estar vacío'),

  birthDate: z.coerce
    .date({ required_error: 'La fecha de nacimiento es obligatoria' })
    .refine(
      (date) => date <= new Date(),
      'La fecha de nacimiento no puede ser futura'
    ),

  sex: sexoEnum,

  phone: z
    .string({ required_error: 'El teléfono es obligatorio' })
    .regex(/\d{10,}/, 'El teléfono debe contener al menos 10 dígitos'),

  email: z
    .string()
    .email('El formato del email no es válido')
    .optional()
    .or(z.literal('')),

  allergies: z
    .array(allergySchema)
    .max(50, 'No se pueden registrar más de 50 alergias')
    .default([]),

  previousSurgeries: z
    .array(previousSurgerySchema)
    .max(30, 'No se pueden registrar más de 30 cirugías previas')
    .default([]),

  profilePhoto: profilePhotoSchema.optional(),
});

/** Schema para creación de paciente (todos los campos obligatorios presentes) */
export const createPatientSchema = patientSchema;

/** Schema para actualización parcial de paciente */
export const updatePatientSchema = patientSchema.partial();

/** Tipos inferidos */
export type PatientInput = z.infer<typeof patientSchema>;
export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type ProfilePhotoInput = z.infer<typeof profilePhotoSchema>;
export type PreviousSurgeryInput = z.infer<typeof previousSurgerySchema>;
