"use strict";
// Session, authentication, and security constants
Object.defineProperty(exports, "__esModule", { value: true });
exports.REFRESH_TOKEN_TTL_SECONDS = exports.REFRESH_TOKEN_EXPIRY = exports.ACCESS_TOKEN_EXPIRY = exports.LOCKOUT_DURATION_MS = exports.MAX_LOGIN_ATTEMPTS = exports.INACTIVITY_TIMEOUT_MS = void 0;
/** Inactivity timeout in milliseconds (15 minutes) */
exports.INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
/** Maximum failed login attempts before lockout */
exports.MAX_LOGIN_ATTEMPTS = 5;
/** Account lockout duration in milliseconds (15 minutes) */
exports.LOCKOUT_DURATION_MS = 15 * 60 * 1000;
/** Access token expiry duration */
exports.ACCESS_TOKEN_EXPIRY = '15m';
/** Refresh token expiry duration */
exports.REFRESH_TOKEN_EXPIRY = '7d';
/** Refresh token TTL in seconds (7 days) */
exports.REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
//# sourceMappingURL=session.constants.js.map