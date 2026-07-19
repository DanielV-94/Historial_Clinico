import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks an endpoint as public — no JWT authentication required.
 * Use for endpoints like /auth/login and /theme/current.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
