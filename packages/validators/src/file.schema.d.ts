import { z } from 'zod';
/**
 * Schema de validación para archivos subidos al sistema.
 * Validates: Requirements 2.4, 3.5, 3.6, 12.3, 12.5
 */
/** Categorías de archivo */
export declare const fileCategoryEnum: z.ZodEnum<["pdf", "image", "video"]>;
/** MIME types permitidos por categoría */
export declare const ALLOWED_MIME_TYPES: {
    readonly pdf: readonly ["application/pdf"];
    readonly image: readonly ["image/jpeg", "image/png", "image/heic"];
    readonly video: readonly ["video/mp4", "video/quicktime"];
};
/** Todos los MIME types permitidos */
export declare const ALL_ALLOWED_MIME_TYPES: readonly ["application/pdf", "image/jpeg", "image/png", "image/heic", "video/mp4", "video/quicktime"];
/** Límites de tamaño por categoría (en bytes) */
export declare const FILE_SIZE_LIMITS: {
    readonly pdf: number;
    readonly image: number;
    readonly video: number;
    readonly general: number;
};
/** Tipo de MIME type permitido */
export type AllowedMimeType = (typeof ALL_ALLOWED_MIME_TYPES)[number];
/** Validación de checksum SHA-256 (64 caracteres hexadecimales) */
export declare const checksumSchema: z.ZodString;
/** Helper: determinar categoría a partir de MIME type */
export declare function getCategoryFromMime(mimeType: string): 'pdf' | 'image' | 'video' | null;
/** Helper: obtener límite de tamaño para un MIME type */
export declare function getSizeLimitForMime(mimeType: string): number;
/** Schema de validación de archivo */
export declare const fileValidationSchema: z.ZodEffects<z.ZodObject<{
    mimeType: z.ZodEffects<z.ZodString, string, string>;
    sizeBytes: z.ZodNumber;
    checksum: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sizeBytes: number;
    checksum: string;
    mimeType: string;
}, {
    sizeBytes: number;
    checksum: string;
    mimeType: string;
}>, {
    sizeBytes: number;
    checksum: string;
    mimeType: string;
}, {
    sizeBytes: number;
    checksum: string;
    mimeType: string;
}>;
/** Schema para metadatos adicionales del archivo */
export declare const fileMetadataSchema: z.ZodObject<{
    originalName: z.ZodString;
    category: z.ZodEnum<["pdf", "image", "video"]>;
    studyType: z.ZodOptional<z.ZodString>;
    captureDate: z.ZodOptional<z.ZodDate>;
    anatomicalZone: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    originalName: string;
    category: "pdf" | "image" | "video";
    notes?: string | undefined;
    studyType?: string | undefined;
    captureDate?: Date | undefined;
    anatomicalZone?: string | undefined;
}, {
    originalName: string;
    category: "pdf" | "image" | "video";
    notes?: string | undefined;
    studyType?: string | undefined;
    captureDate?: Date | undefined;
    anatomicalZone?: string | undefined;
}>;
/** Schema completo de upload (validación + metadatos) */
export declare const fileUploadSchema: z.ZodIntersection<z.ZodEffects<z.ZodObject<{
    mimeType: z.ZodEffects<z.ZodString, string, string>;
    sizeBytes: z.ZodNumber;
    checksum: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sizeBytes: number;
    checksum: string;
    mimeType: string;
}, {
    sizeBytes: number;
    checksum: string;
    mimeType: string;
}>, {
    sizeBytes: number;
    checksum: string;
    mimeType: string;
}, {
    sizeBytes: number;
    checksum: string;
    mimeType: string;
}>, z.ZodObject<{
    originalName: z.ZodString;
    category: z.ZodEnum<["pdf", "image", "video"]>;
    studyType: z.ZodOptional<z.ZodString>;
    captureDate: z.ZodOptional<z.ZodDate>;
    anatomicalZone: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    originalName: string;
    category: "pdf" | "image" | "video";
    notes?: string | undefined;
    studyType?: string | undefined;
    captureDate?: Date | undefined;
    anatomicalZone?: string | undefined;
}, {
    originalName: string;
    category: "pdf" | "image" | "video";
    notes?: string | undefined;
    studyType?: string | undefined;
    captureDate?: Date | undefined;
    anatomicalZone?: string | undefined;
}>>;
/** Tipos inferidos */
export type FileValidationInput = z.infer<typeof fileValidationSchema>;
export type FileMetadataInput = z.infer<typeof fileMetadataSchema>;
export type FileUploadInput = z.infer<typeof fileUploadSchema>;
export type FileCategory = z.infer<typeof fileCategoryEnum>;
//# sourceMappingURL=file.schema.d.ts.map