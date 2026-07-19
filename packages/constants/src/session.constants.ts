// Session, authentication, and security constants

/** Inactivity timeout in milliseconds (15 minutes) */
export const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

/** Maximum failed login attempts before lockout */
export const MAX_LOGIN_ATTEMPTS = 5;

/** Account lockout duration in milliseconds (15 minutes) */
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

/** Access token expiry duration */
export const ACCESS_TOKEN_EXPIRY = '15m';

/** Refresh token expiry duration */
export const REFRESH_TOKEN_EXPIRY = '7d';

/** Refresh token TTL in seconds (7 days) */
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
