"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePatientSchema = exports.createPatientSchema = exports.patientSchema = exports.profilePhotoSchema = exports.previousSurgerySchema = exports.allergySchema = exports.sexoEnum = void 0;
const zod_1 = require("zod");
/**
 * Schema de validación para datos de paciente.
 * Validates: Requirements 1.3, 1.4, 7.4
 */
/** Sexo biológico del paciente */
exports.sexoEnum = zod_1.z.enum(['M', 'F', 'O']);
/** Validación de alergia individual (max 200 chars) */
exports.allergySchema = zod_1.z
    .string()
    .min(1, 'La alergia no puede estar vacía')
    .max(200, 'La alergia no puede exceder 200 caracteres');
/** Validación de cirugía previa */
exports.previousSurgerySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'El nombre de la cirugía es obligatorio'),
    date: zod_1.z.coerce.date({ required_error: 'La fecha de la cirugía es obligatoria' }),
});
/** Validación de foto de perfil */
exports.profilePhotoSchema = zod_1.z.object({
    mimeType: zod_1.z.enum(['image/jpeg', 'image/png'], {
        errorMap: () => ({ message: 'La foto de perfil debe ser JPEG o PNG' }),
    }),
    sizeBytes: zod_1.z
        .number()
        .max(5 * 1024 * 1024, 'La foto de perfil no puede exceder 5 MB'),
});
/** Schema principal de paciente */
exports.patientSchema = zod_1.z.object({
    fullName: zod_1.z
        .string({ required_error: 'El nombre completo es obligatorio' })
        .min(1, 'El nombre completo no puede estar vacío'),
    birthDate: zod_1.z.coerce
        .date({ required_error: 'La fecha de nacimiento es obligatoria' })
        .refine((date) => date <= new Date(), 'La fecha de nacimiento no puede ser futura'),
    sex: exports.sexoEnum,
    phone: zod_1.z
        .string({ required_error: 'El teléfono es obligatorio' })
        .regex(/\d{10,}/, 'El teléfono debe contener al menos 10 dígitos'),
    email: zod_1.z
        .string()
        .email('El formato del email no es válido')
        .optional()
        .or(zod_1.z.literal('')),
    allergies: zod_1.z
        .array(exports.allergySchema)
        .max(50, 'No se pueden registrar más de 50 alergias')
        .default([]),
    previousSurgeries: zod_1.z
        .array(exports.previousSurgerySchema)
        .max(30, 'No se pueden registrar más de 30 cirugías previas')
        .default([]),
    profilePhoto: exports.profilePhotoSchema.optional(),
});
/** Schema para creación de paciente (todos los campos obligatorios presentes) */
exports.createPatientSchema = exports.patientSchema;
/** Schema para actualización parcial de paciente */
exports.updatePatientSchema = exports.patientSchema.partial();
//# sourceMappingURL=patient.schema.js.map