"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_THEME = exports.themeConfigSchema = exports.logoSchema = exports.LOGO_MAX_SIZE = exports.LOGO_ALLOWED_MIME_TYPES = exports.hexColorSchema = void 0;
const zod_1 = require("zod");
/**
 * Schema de validación para configuración de tema (white-label).
 * Validates: Requirements 10.1, 10.4
 */
/** Regex para color hexadecimal #RRGGBB */
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
/** Schema para color hexadecimal */
exports.hexColorSchema = zod_1.z
    .string()
    .regex(HEX_COLOR_REGEX, 'El color debe tener formato hexadecimal válido (#RRGGBB)');
/** MIME types permitidos para logo */
exports.LOGO_ALLOWED_MIME_TYPES = ['image/png', 'image/svg+xml'];
/** Tamaño máximo del logo: 2 MB */
exports.LOGO_MAX_SIZE = 2 * 1024 * 1024;
/** Schema de validación del logo */
exports.logoSchema = zod_1.z.object({
    mimeType: zod_1.z.enum(exports.LOGO_ALLOWED_MIME_TYPES, {
        errorMap: () => ({ message: 'El logo debe ser PNG o SVG' }),
    }),
    sizeBytes: zod_1.z
        .number()
        .positive('El tamaño del logo debe ser mayor a 0')
        .max(exports.LOGO_MAX_SIZE, 'El logo no puede exceder 2 MB'),
});
/** Schema completo de configuración de tema */
exports.themeConfigSchema = zod_1.z.object({
    clinicName: zod_1.z
        .string({ required_error: 'El nombre de la clínica es obligatorio' })
        .min(1, 'El nombre de la clínica no puede estar vacío'),
    primaryColor: exports.hexColorSchema,
    secondaryColor: exports.hexColorSchema,
    accentColor: exports.hexColorSchema,
    fontFamily: zod_1.z
        .string({ required_error: 'La familia tipográfica es obligatoria' })
        .min(1, 'La familia tipográfica no puede estar vacía'),
    logo: exports.logoSchema.optional(),
});
/** Valores por defecto del tema */
exports.DEFAULT_THEME = {
    clinicName: 'Clínica',
    primaryColor: '#2563EB',
    secondaryColor: '#1E40AF',
    accentColor: '#3B82F6',
    fontFamily: 'Inter',
};
//# sourceMappingURL=theme.schema.js.map