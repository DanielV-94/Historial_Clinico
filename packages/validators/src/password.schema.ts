import { z } from 'zod';

/**
 * Schema de validación para contraseñas.
 * Validates: Requirements 13.1
 */

/** Requisitos de contraseña */
export const PASSWORD_MIN_LENGTH = 8;

/** Schema de contraseña segura */
export const passwordSchema = z
  .string({ required_error: 'La contraseña es obligatoria' })
  .min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`)
  .regex(/[A-Z]/, 'La contraseña debe contener al menos una letra mayúscula')
  .regex(/[a-z]/, 'La contraseña debe contener al menos una letra minúscula')
  .regex(/[0-9]/, 'La contraseña debe contener al menos un número');

/** Tipos inferidos */
export type PasswordInput = z.infer<typeof passwordSchema>;
