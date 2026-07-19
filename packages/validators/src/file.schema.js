"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileUploadSchema = exports.fileMetadataSchema = exports.fileValidationSchema = exports.checksumSchema = exports.FILE_SIZE_LIMITS = exports.ALL_ALLOWED_MIME_TYPES = exports.ALLOWED_MIME_TYPES = exports.fileCategoryEnum = void 0;
exports.getCategoryFromMime = getCategoryFromMime;
exports.getSizeLimitForMime = getSizeLimitForMime;
const zod_1 = require("zod");
/**
 * Schema de validación para archivos subidos al sistema.
 * Validates: Requirements 2.4, 3.5, 3.6, 12.3, 12.5
 */
/** Categorías de archivo */
exports.fileCategoryEnum = zod_1.z.enum(['pdf', 'image', 'video']);
/** MIME types permitidos por categoría */
exports.ALLOWED_MIME_TYPES = {
    pdf: ['application/pdf'],
    image: ['image/jpeg', 'image/png', 'image/heic'],
    video: ['video/mp4', 'video/quicktime'],
};
/** Todos los MIME types permitidos */
exports.ALL_ALLOWED_MIME_TYPES = [
    ...exports.ALLOWED_MIME_TYPES.pdf,
    ...exports.ALLOWED_MIME_TYPES.image,
    ...exports.ALLOWED_MIME_TYPES.video,
];
/** Límites de tamaño por categoría (en bytes) */
exports.FILE_SIZE_LIMITS = {
    pdf: 20 * 1024 * 1024, // 20 MB
    image: 50 * 1024 * 1024, // 50 MB
    video: 200 * 1024 * 1024, // 200 MB
    general: 500 * 1024 * 1024, // 500 MB
};
/** Validación de checksum SHA-256 (64 caracteres hexadecimales) */
exports.checksumSchema = zod_1.z
    .string()
    .regex(/^[a-f0-9]{64}$/i, 'El checksum debe ser un SHA-256 válido (64 caracteres hexadecimales)');
/** Helper: determinar categoría a partir de MIME type */
function getCategoryFromMime(mimeType) {
    if (exports.ALLOWED_MIME_TYPES.pdf.includes(mimeType))
        return 'pdf';
    if (exports.ALLOWED_MIME_TYPES.image.includes(mimeType))
        return 'image';
    if (exports.ALLOWED_MIME_TYPES.video.includes(mimeType))
        return 'video';
    return null;
}
/** Helper: obtener límite de tamaño para un MIME type */
function getSizeLimitForMime(mimeType) {
    const category = getCategoryFromMime(mimeType);
    if (!category)
        return exports.FILE_SIZE_LIMITS.general;
    return exports.FILE_SIZE_LIMITS[category];
}
/** Schema de validación de archivo */
exports.fileValidationSchema = zod_1.z
    .object({
    mimeType: zod_1.z.string().refine((mime) => exports.ALL_ALLOWED_MIME_TYPES.includes(mime), (mime) => ({
        message: `Formato no permitido: ${mime}. Formatos válidos: ${exports.ALL_ALLOWED_MIME_TYPES.join(', ')}`,
    })),
    sizeBytes: zod_1.z
        .number({ required_error: 'El tamaño del archivo es obligatorio' })
        .positive('El tamaño debe ser mayor a 0')
        .max(exports.FILE_SIZE_LIMITS.general, `El archivo no puede exceder ${exports.FILE_SIZE_LIMITS.general / (1024 * 1024)} MB`),
    checksum: exports.checksumSchema,
})
    .refine((data) => {
    const limit = getSizeLimitForMime(data.mimeType);
    return data.sizeBytes <= limit;
}, (data) => {
    const category = getCategoryFromMime(data.mimeType);
    const limit = getSizeLimitForMime(data.mimeType);
    const limitMB = limit / (1024 * 1024);
    return {
        message: `El archivo de tipo ${category ?? 'desconocido'} no puede exceder ${limitMB} MB`,
        path: ['sizeBytes'],
    };
});
/** Schema para metadatos adicionales del archivo */
exports.fileMetadataSchema = zod_1.z.object({
    originalName: zod_1.z.string().min(1, 'El nombre original es obligatorio'),
    category: exports.fileCategoryEnum,
    studyType: zod_1.z.string().optional(),
    captureDate: zod_1.z.coerce.date().optional(),
    anatomicalZone: zod_1.z.string().optional(),
    notes: zod_1.z.string().max(500, 'Las notas no pueden exceder 500 caracteres').optional(),
});
/** Schema completo de upload (validación + metadatos) */
exports.fileUploadSchema = exports.fileValidationSchema.and(exports.fileMetadataSchema);
//# sourceMappingURL=file.schema.js.map