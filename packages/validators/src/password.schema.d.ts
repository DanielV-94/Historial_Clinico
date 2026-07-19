import { z } from 'zod';
/**
 * Schema de validación para contraseñas.
 * Validates: Requirements 13.1
 */
/** Requisitos de contraseña */
export declare const PASSWORD_MIN_LENGTH = 8;
/** Schema de contraseña segura */
export declare const passwordSchema: z.ZodString;
/** Tipos inferidos */
export type PasswordInput = z.infer<typeof passwordSchema>;
//# sourceMappingURL=password.schema.d.ts.map