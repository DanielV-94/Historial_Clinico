import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorator to annotate controller methods or classes with required roles.
 * Used by RolesGuard to verify the user has one of the specified roles.
 *
 * @example
 * @Roles('doctor', 'admin')
 * @Get('/patients')
 * findAll() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
