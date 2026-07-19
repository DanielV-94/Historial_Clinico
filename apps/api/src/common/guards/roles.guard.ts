import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';

/**
 * Global guard that enforces role-based access control (RBAC).
 * Reads required roles from @Roles() decorator and compares against request user's role.
 *
 * RBAC Matrix (Requirements 13.2):
 * - Doctor: patient(RW), dashboard_doctor(R), ai(R)
 * - Assistant: dashboard_assistant(RW), patient(R)
 * - Admin: all modules (RW)
 * - Kiosk: kiosk(RW)
 *
 * Implements "fail-closed": if verification fails for ANY reason, access is denied (HTTP 403).
 *
 * @validates Requirements 8.3, 13.2, 13.5
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip role checking for @Public() endpoints
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Get required roles from decorator metadata
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are specified, the endpoint is accessible to any authenticated user
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Fail-closed: if user is not available on request, deny access
    const request = context.switchToHttp().getRequest();
    const user: JwtPayload | undefined = request.user;

    if (!user) {
      this.logger.warn('RolesGuard: No user found on request — denying access (fail-closed)');
      throw new ForbiddenException('Acceso denegado: usuario no identificado');
    }

    if (!user.role) {
      this.logger.warn(`RolesGuard: User ${user.sub} has no role — denying access (fail-closed)`);
      throw new ForbiddenException('Acceso denegado: rol no definido');
    }

    // Check if user's role is in the required roles list
    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      this.logger.warn(
        `RolesGuard: User ${user.sub} with role "${user.role}" attempted to access endpoint requiring roles [${requiredRoles.join(', ')}]`,
      );
      throw new ForbiddenException(
        'Acceso denegado: permisos insuficientes para este recurso',
      );
    }

    return true;
  }
}
