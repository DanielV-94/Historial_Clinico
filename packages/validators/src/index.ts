// Barrel export for @historial/validators
// Zod schemas compartidos entre frontend y backend

export {
  // Patient schemas
  patientSchema,
  createPatientSchema,
  updatePatientSchema,
  profilePhotoSchema,
  allergySchema,
  previousSurgerySchema,
  sexoEnum,
  // Patient types
  type PatientInput,
  type CreatePatientInput,
  type UpdatePatientInput,
  type ProfilePhotoInput,
  type PreviousSurgeryInput,
} from './patient.schema';

export {
  // File schemas
  fileValidationSchema,
  fileMetadataSchema,
  fileUploadSchema,
  fileCategoryEnum,
  checksumSchema,
  // File constants
  ALLOWED_MIME_TYPES,
  ALL_ALLOWED_MIME_TYPES,
  FILE_SIZE_LIMITS,
  // File helpers
  getCategoryFromMime,
  getSizeLimitForMime,
  // File types
  type FileValidationInput,
  type FileMetadataInput,
  type FileUploadInput,
  type FileCategory,
  type AllowedMimeType,
} from './file.schema';

export {
  // Clinical note schemas
  clinicalNoteContentSchema,
  createClinicalNoteSchema,
  // Clinical note constants
  NOTE_MIN_LENGTH,
  NOTE_MAX_LENGTH,
  // Clinical note types
  type ClinicalNoteContentInput,
  type CreateClinicalNoteInput,
} from './note.schema';

export {
  // Password schema
  passwordSchema,
  // Password constants
  PASSWORD_MIN_LENGTH,
  // Password types
  type PasswordInput,
} from './password.schema';

export {
  // Theme schemas
  themeConfigSchema,
  hexColorSchema,
  logoSchema,
  // Theme constants
  LOGO_ALLOWED_MIME_TYPES,
  LOGO_MAX_SIZE,
  DEFAULT_THEME,
  // Theme types
  type ThemeConfigInput,
  type LogoInput,
  type HexColor,
} from './theme.schema';
