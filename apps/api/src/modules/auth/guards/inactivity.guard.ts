import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Inject,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import Redis from 'ioredis';

import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { REDIS_CLIENT } from '../redis.provider';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

// Inactivity timeout (from @historial/constants)
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Guard that enforces session inactivity timeout.
 * - Checks `last_activity:{userId}` timestamp in Redis
 * - If last activity > INACTIVITY_TIMEOUT_MS (15 min), respond with 401
 * - On each authenticated request, updates the `last_activity` timestamp
 * - Skips @Public() routes (login, refresh)
 *
 * @validates Requirements 13.3
 */
@Injectable()
export class InactivityGuard implements CanActivate {
  private readonly logger = new Logger(InactivityGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip inactivity check for @Public() endpoints
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user as JwtPayload | undefined;

    // If no user attached yet (JwtAuthGuard hasn't run or route is unauthenticated), skip
    if (!user?.sub) {
      return true;
    }

    const userId = user.sub;
    const redisKey = `last_activity:${userId}`;

    // Check last activity timestamp
    const lastActivityStr = await this.redis.get(redisKey);

    if (lastActivityStr) {
      const lastActivity = parseInt(lastActivityStr, 10);
      const elapsed = Date.now() - lastActivity;

      if (elapsed > INACTIVITY_TIMEOUT_MS) {
        this.logger.debug(
          `Session expired due to inactivity for user ${userId} (${Math.round(elapsed / 60000)} min idle)`,
        );
        throw new UnauthorizedException(
          'Sesión expirada por inactividad',
        );
      }
    }

    // Update last activity timestamp
    // TTL set to INACTIVITY_TIMEOUT_MS + buffer to auto-cleanup stale entries
    const ttlSeconds = Math.ceil(INACTIVITY_TIMEOUT_MS / 1000) + 60;
    await this.redis.set(redisKey, Date.now().toString(), 'EX', ttlSeconds);

    return true;
  }
}
