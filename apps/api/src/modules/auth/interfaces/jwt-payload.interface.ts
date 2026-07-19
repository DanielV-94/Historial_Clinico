import { UserRole } from '@prisma/client';

/**
 * JWT Access Token payload structure.
 */
export interface JwtPayload {
  /** User ID (subject) */
  sub: string;
  /** User role */
  role: UserRole;
  /** Username */
  username: string;
}

/**
 * JWT Refresh Token payload structure.
 */
export interface JwtRefreshPayload {
  /** User ID (subject) */
  sub: string;
  /** Unique token identifier for rotation tracking */
  tokenId: string;
}
