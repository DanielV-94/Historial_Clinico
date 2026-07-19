import { z } from 'zod';

/**
 * Schema de validación para archivos subidos al sistema.
 * Validates: Requirements 2.4, 3.5, 3.6, 12.3, 12.5
 */

/** Categorías de archivo */
export const fileCategoryEnum = z.enum(['pdf', 'image', 'video']);

/** MIME types permitidos por categoría */
export const ALLOWED_MIME_TYPES = {
  pdf: ['application/pdf'] as const,
  image: ['image/jpeg', 'image/png', 'image/heic'] as const,
  video: ['video/mp4', 'video/quicktime'] as const,
} as const;

/** Todos los MIME types permitidos */
export const ALL_ALLOWED_MIME_TYPES = [
  ...ALLOWED_MIME_TYPES.pdf,
  ...ALLOWED_MIME_TYPES.image,
  ...ALLOWED_MIME_TYPES.video,
] as const;

/** Límites de tamaño por categoría (en bytes) */
export const FILE_SIZE_LIMITS = {
  pdf: 20 * 1024 * 1024,       // 20 MB
  image: 50 * 1024 * 1024,     // 50 MB
  video: 200 * 1024 * 1024,    // 200 MB
  general: 500 * 1024 * 1024,  // 500 MB
} as const;

/** Tipo de MIME type permitido */
export type AllowedMimeType = (typeof ALL_ALLOWED_MIME_TYPES)[number];

/** Validación de checksum SHA-256 (64 caracteres hexadecimales) */
export const checksumSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/i, 'El checksum debe ser un SHA-256 válido (64 caracteres hexadecimales)');

/** Helper: determinar categoría a partir de MIME type */
export function getCategoryFromMime(mimeType: string): 'pdf' | 'image' | 'video' | null {
  if ((ALLOWED_MIME_TYPES.pdf as readonly string[]).includes(mimeType)) return 'pdf';
  if ((ALLOWED_MIME_TYPES.image as readonly string[]).includes(mimeType)) return 'image';
  if ((ALLOWED_MIME_TYPES.video as readonly string[]).includes(mimeType)) return 'video';
  return null;
}

/** Helper: obtener límite de tamaño para un MIME type */
export function getSizeLimitForMime(mimeType: string): number {
  const category = getCategoryFromMime(mimeType);
  if (!category) return FILE_SIZE_LIMITS.general;
  return FILE_SIZE_LIMITS[category];
}

/** Schema de validación de archivo */
export const fileValidationSchema = z
  .object({
    mimeType: z.string().refine(
      (mime) => (ALL_ALLOWED_MIME_TYPES as readonly string[]).includes(mime),
      (mime) => ({
        message: `Formato no permitido: ${mime}. Formatos válidos: ${ALL_ALLOWED_MIME_TYPES.join(', ')}`,
      })
    ),
    sizeBytes: z
      .number({ required_error: 'El tamaño del archivo es obligatorio' })
      .positive('El tamaño debe ser mayor a 0')
      .max(FILE_SIZE_LIMITS.general, `El archivo no puede exceder ${FILE_SIZE_LIMITS.general / (1024 * 1024)} MB`),
    checksum: checksumSchema,
  })
  .refine(
    (data) => {
      const limit = getSizeLimitForMime(data.mimeType);
      return data.sizeBytes <= limit;
    },
    (data) => {
      const category = getCategoryFromMime(data.mimeType);
      const limit = getSizeLimitForMime(data.mimeType);
      const limitMB = limit / (1024 * 1024);
      return {
        message: `El archivo de tipo ${category ?? 'desconocido'} no puede exceder ${limitMB} MB`,
        path: ['sizeBytes'],
      };
    }
  );

/** Schema para metadatos adicionales del archivo */
export const fileMetadataSchema = z.object({
  originalName: z.string().min(1, 'El nombre original es obligatorio'),
  category: fileCategoryEnum,
  studyType: z.string().optional(),
  captureDate: z.coerce.date().optional(),
  anatomicalZone: z.string().optional(),
  notes: z.string().max(500, 'Las notas no pueden exceder 500 caracteres').optional(),
});

/** Schema completo de upload (validación + metadatos) */
export const fileUploadSchema = fileValidationSchema.and(fileMetadataSchema);

/** Tipos inferidos */
export type FileValidationInput = z.infer<typeof fileValidationSchema>;
export type FileMetadataInput = z.infer<typeof fileMetadataSchema>;
export type FileUploadInput = z.infer<typeof fileUploadSchema>;
export type FileCategory = z.infer<typeof fileCategoryEnum>;
