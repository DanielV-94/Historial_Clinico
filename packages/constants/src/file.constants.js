"use strict";
// File upload limits and allowed MIME types
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_ALLOWED_MIMES = exports.ALLOWED_VIDEO_MIMES = exports.ALLOWED_IMAGE_MIMES = exports.ALLOWED_PDF_MIMES = exports.GENERAL_MAX_SIZE = exports.VIDEO_MAX_SIZE = exports.IMAGE_MAX_SIZE = exports.PDF_MAX_SIZE = void 0;
/** Maximum PDF file size in bytes (20 MB) */
exports.PDF_MAX_SIZE = 20 * 1024 * 1024;
/** Maximum image file size in bytes (50 MB) */
exports.IMAGE_MAX_SIZE = 50 * 1024 * 1024;
/** Maximum video file size in bytes (200 MB) */
exports.VIDEO_MAX_SIZE = 200 * 1024 * 1024;
/** Maximum general file size in bytes (500 MB) */
exports.GENERAL_MAX_SIZE = 500 * 1024 * 1024;
/** Allowed MIME types for PDF files */
exports.ALLOWED_PDF_MIMES = ['application/pdf'];
/** Allowed MIME types for image files */
exports.ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/heic'];
/** Allowed MIME types for video files */
exports.ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/quicktime'];
/** Union of all allowed MIME types */
exports.ALL_ALLOWED_MIMES = [
    ...exports.ALLOWED_PDF_MIMES,
    ...exports.ALLOWED_IMAGE_MIMES,
    ...exports.ALLOWED_VIDEO_MIMES,
];
//# sourceMappingURL=file.constants.js.map