"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordSchema = exports.PASSWORD_MIN_LENGTH = void 0;
const zod_1 = require("zod");
/**
 * Schema de validación para contraseñas.
 * Validates: Requirements 13.1
 */
/** Requisitos de contraseña */
exports.PASSWORD_MIN_LENGTH = 8;
/** Schema de contraseña segura */
exports.passwordSchema = zod_1.z
    .string({ required_error: 'La contraseña es obligatoria' })
    .min(exports.PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${exports.PASSWORD_MIN_LENGTH} caracteres`)
    .regex(/[A-Z]/, 'La contraseña debe contener al menos una letra mayúscula')
    .regex(/[a-z]/, 'La contraseña debe contener al menos una letra minúscula')
    .regex(/[0-9]/, 'La contraseña debe contener al menos un número');
//# sourceMappingURL=password.schema.js.map