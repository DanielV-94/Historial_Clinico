import { z } from 'zod';
/**
 * Schema de validación para notas clínicas.
 * Validates: Requirements 4.1, 4.2
 */
/** Longitud mínima y máxima del contenido */
export declare const NOTE_MIN_LENGTH = 1;
export declare const NOTE_MAX_LENGTH = 10000;
/** Schema de contenido de nota clínica */
export declare const clinicalNoteContentSchema: z.ZodString;
/** Schema completo de creación de nota clínica */
export declare const createClinicalNoteSchema: z.ZodObject<{
    content: z.ZodString;
    patientId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    patientId: string;
    content: string;
}, {
    patientId: string;
    content: string;
}>;
/** Tipos inferidos */
export type ClinicalNoteContentInput = z.infer<typeof clinicalNoteContentSchema>;
export type CreateClinicalNoteInput = z.infer<typeof createClinicalNoteSchema>;
//# sourceMappingURL=note.schema.d.ts.map