// Theme and branding constants

/** Maximum logo file size in bytes (2 MB) */
export const LOGO_MAX_SIZE = 2 * 1024 * 1024;

/** Allowed MIME types for logo uploads */
export const ALLOWED_LOGO_MIMES = ['image/png', 'image/svg+xml'] as const;

/** Theme polling interval in milliseconds (30 seconds) */
export const THEME_POLL_INTERVAL_MS = 30_000;
