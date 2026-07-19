"use strict";
// Barrel export for @historial/validators
// Zod schemas compartidos entre frontend y backend
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_THEME = exports.LOGO_MAX_SIZE = exports.LOGO_ALLOWED_MIME_TYPES = exports.logoSchema = exports.hexColorSchema = exports.themeConfigSchema = exports.PASSWORD_MIN_LENGTH = exports.passwordSchema = exports.NOTE_MAX_LENGTH = exports.NOTE_MIN_LENGTH = exports.createClinicalNoteSchema = exports.clinicalNoteContentSchema = exports.getSizeLimitForMime = exports.getCategoryFromMime = exports.FILE_SIZE_LIMITS = exports.ALL_ALLOWED_MIME_TYPES = exports.ALLOWED_MIME_TYPES = exports.checksumSchema = exports.fileCategoryEnum = exports.fileUploadSchema = exports.fileMetadataSchema = exports.fileValidationSchema = exports.sexoEnum = exports.previousSurgerySchema = exports.allergySchema = exports.profilePhotoSchema = exports.updatePatientSchema = exports.createPatientSchema = exports.patientSchema = void 0;
var patient_schema_1 = require("./patient.schema");
// Patient schemas
Object.defineProperty(exports, "patientSchema", { enumerable: true, get: function () { return patient_schema_1.patientSchema; } });
Object.defineProperty(exports, "createPatientSchema", { enumerable: true, get: function () { return patient_schema_1.createPatientSchema; } });
Object.defineProperty(exports, "updatePatientSchema", { enumerable: true, get: function () { return patient_schema_1.updatePatientSchema; } });
Object.defineProperty(exports, "profilePhotoSchema", { enumerable: true, get: function () { return patient_schema_1.profilePhotoSchema; } });
Object.defineProperty(exports, "allergySchema", { enumerable: true, get: function () { return patient_schema_1.allergySchema; } });
Object.defineProperty(exports, "previousSurgerySchema", { enumerable: true, get: function () { return patient_schema_1.previousSurgerySchema; } });
Object.defineProperty(exports, "sexoEnum", { enumerable: true, get: function () { return patient_schema_1.sexoEnum; } });
var file_schema_1 = require("./file.schema");
// File schemas
Object.defineProperty(exports, "fileValidationSchema", { enumerable: true, get: function () { return file_schema_1.fileValidationSchema; } });
Object.defineProperty(exports, "fileMetadataSchema", { enumerable: true, get: function () { return file_schema_1.fileMetadataSchema; } });
Object.defineProperty(exports, "fileUploadSchema", { enumerable: true, get: function () { return file_schema_1.fileUploadSchema; } });
Object.defineProperty(exports, "fileCategoryEnum", { enumerable: true, get: function () { return file_schema_1.fileCategoryEnum; } });
Object.defineProperty(exports, "checksumSchema", { enumerable: true, get: function () { return file_schema_1.checksumSchema; } });
// File constants
Object.defineProperty(exports, "ALLOWED_MIME_TYPES", { enumerable: true, get: function () { return file_schema_1.ALLOWED_MIME_TYPES; } });
Object.defineProperty(exports, "ALL_ALLOWED_MIME_TYPES", { enumerable: true, get: function () { return file_schema_1.ALL_ALLOWED_MIME_TYPES; } });
Object.defineProperty(exports, "FILE_SIZE_LIMITS", { enumerable: true, get: function () { return file_schema_1.FILE_SIZE_LIMITS; } });
// File helpers
Object.defineProperty(exports, "getCategoryFromMime", { enumerable: true, get: function () { return file_schema_1.getCategoryFromMime; } });
Object.defineProperty(exports, "getSizeLimitForMime", { enumerable: true, get: function () { return file_schema_1.getSizeLimitForMime; } });
var note_schema_1 = require("./note.schema");
// Clinical note schemas
Object.defineProperty(exports, "clinicalNoteContentSchema", { enumerable: true, get: function () { return note_schema_1.clinicalNoteContentSchema; } });
Object.defineProperty(exports, "createClinicalNoteSchema", { enumerable: true, get: function () { return note_schema_1.createClinicalNoteSchema; } });
// Clinical note constants
Object.defineProperty(exports, "NOTE_MIN_LENGTH", { enumerable: true, get: function () { return note_schema_1.NOTE_MIN_LENGTH; } });
Object.defineProperty(exports, "NOTE_MAX_LENGTH", { enumerable: true, get: function () { return note_schema_1.NOTE_MAX_LENGTH; } });
var password_schema_1 = require("./password.schema");
// Password schema
Object.defineProperty(exports, "passwordSchema", { enumerable: true, get: function () { return password_schema_1.passwordSchema; } });
// Password constants
Object.defineProperty(exports, "PASSWORD_MIN_LENGTH", { enumerable: true, get: function () { return password_schema_1.PASSWORD_MIN_LENGTH; } });
var theme_schema_1 = require("./theme.schema");
// Theme schemas
Object.defineProperty(exports, "themeConfigSchema", { enumerable: true, get: function () { return theme_schema_1.themeConfigSchema; } });
Object.defineProperty(exports, "hexColorSchema", { enumerable: true, get: function () { return theme_schema_1.hexColorSchema; } });
Object.defineProperty(exports, "logoSchema", { enumerable: true, get: function () { return theme_schema_1.logoSchema; } });
// Theme constants
Object.defineProperty(exports, "LOGO_ALLOWED_MIME_TYPES", { enumerable: true, get: function () { return theme_schema_1.LOGO_ALLOWED_MIME_TYPES; } });
Object.defineProperty(exports, "LOGO_MAX_SIZE", { enumerable: true, get: function () { return theme_schema_1.LOGO_MAX_SIZE; } });
Object.defineProperty(exports, "DEFAULT_THEME", { enumerable: true, get: function () { return theme_schema_1.DEFAULT_THEME; } });
//# sourceMappingURL=index.js.map