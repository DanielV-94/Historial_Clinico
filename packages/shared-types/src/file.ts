/**
 * Tipos relacionados con gestión de archivos y almacenamiento.
 * @validates Requirements 12.2
 */

/** Categoría de archivo */
export type FileCategory = 'pdf' | 'image' | 'video';

/** Metadatos de archivo almacenado */
export interface FileMetadata {
  id: string;
  patientId: string;
  originalName: string;
  uniqueName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;            // ISO 8601
  uploadedBy: string;
  checksum: string;              // SHA-256
  category: FileCategory;
  studyType?: string | null;
  captureDate?: string | null;   // ISO 8601 date (YYYY-MM-DD)
  anatomicalZone?: string | null;
  notes?: string | null;
  hasWatermark?: boolean;
}
