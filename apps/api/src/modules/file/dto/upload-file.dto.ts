/**
 * DTO for file upload metadata.
 * The actual file binary comes via multipart, this DTO describes the metadata.
 * Validation is performed using Zod schemas from @historial/validators.
 */
export interface UploadFileDto {
  /** Original file name */
  originalName: string;
  /** MIME type of the file */
  mimeType: string;
  /** Type of study (e.g., "radiografia-torax", "analisis-sangre") */
  studyType?: string;
  /** Date when the photo/video was captured */
  captureDate?: string;
  /** Anatomical zone or treatment area */
  anatomicalZone?: string;
  /** Additional notes about the file */
  notes?: string;
}
