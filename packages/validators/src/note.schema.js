"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClinicalNoteSchema = exports.clinicalNoteContentSchema = exports.NOTE_MAX_LENGTH = exports.NOTE_MIN_LENGTH = void 0;
const zod_1 = require("zod");
/**
 * Schema de validación para notas clínicas.
 * Validates: Requirements 4.1, 4.2
 */
/** Longitud mínima y máxima del contenido */
exports.NOTE_MIN_LENGTH = 1;
exports.NOTE_MAX_LENGTH = 10_000;
/** Schema de contenido de nota clínica */
exports.clinicalNoteContentSchema = zod_1.z
    .string({ required_error: 'El contenido de la nota es obligatorio' })
    .min(exports.NOTE_MIN_LENGTH, 'La nota clínica no puede estar vacía')
    .max(exports.NOTE_MAX_LENGTH, `La nota clínica no puede exceder ${exports.NOTE_MAX_LENGTH.toLocaleString()} caracteres`);
/** Schema completo de creación de nota clínica */
exports.createClinicalNoteSchema = zod_1.z.object({
    content: exports.clinicalNoteContentSchema,
    patientId: zod_1.z.string().uuid('El ID del paciente debe ser un UUID válido'),
});
//# sourceMappingURL=note.schema.js.map