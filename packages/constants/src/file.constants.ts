// File upload limits and allowed MIME types

/** Maximum PDF file size in bytes (20 MB) */
export const PDF_MAX_SIZE = 20 * 1024 * 1024;

/** Maximum image file size in bytes (50 MB) */
export const IMAGE_MAX_SIZE = 50 * 1024 * 1024;

/** Maximum video file size in bytes (200 MB) */
export const VIDEO_MAX_SIZE = 200 * 1024 * 1024;

/** Maximum general file size in bytes (500 MB) */
export const GENERAL_MAX_SIZE = 500 * 1024 * 1024;

/** Allowed MIME types for PDF files */
export const ALLOWED_PDF_MIMES = ['application/pdf'] as const;

/** Allowed MIME types for image files */
export const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/heic'] as const;

/** Allowed MIME types for video files */
export const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/quicktime'] as const;

/** Union of all allowed MIME types */
export const ALL_ALLOWED_MIMES = [
  ...ALLOWED_PDF_MIMES,
  ...ALLOWED_IMAGE_MIMES,
  ...ALLOWED_VIDEO_MIMES,
] as const;
