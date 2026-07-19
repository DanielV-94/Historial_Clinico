/**
 * Tipos relacionados con notas clínicas y prescripciones.
 * @validates Requirements 4.1, 4.2, 4.3
 */
/** Nota clínica / nota de evolución */
export interface ClinicalNote {
    id: string;
    patientId: string;
    authorId: string;
    content: string;
    createdAt: string;
}
/** Estado de la prescripción */
export type PrescriptionStatus = 'pending' | 'read' | 'completed';
/** Prescripción o indicación del doctor */
export interface Prescription {
    id: string;
    patientId: string;
    doctorId: string;
    assignedTo: string;
    content: string;
    status: PrescriptionStatus;
    readAt?: string | null;
    completedAt?: string | null;
    createdAt: string;
}
//# sourceMappingURL=clinical.d.ts.map