import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Unit tests for JwtAuthGuard.
 * Validates: Requirements 8.3, 13.2
 */
describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockJwtPayload = {
    sub: 'user-123',
    role: 'doctor',
    username: 'doctor1',
  };

  function createMockContext(authHeader?: string, isPublic = false): ExecutionContext {
    const mockRequest = {
      headers: {
        authorization: authHeader,
      },
      user: undefined,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    reflector = new Reflector();
    jwtService = {
      verifyAsync: vi.fn(),
    } as any;
    configService = {
      get: vi.fn().mockReturnValue('test-access-secret'),
    } as any;

    guard = new JwtAuthGuard(reflector, jwtService, configService);
  });

  it('should allow access to @Public() endpoints without token', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const context = createMockContext(undefined, true);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should throw UnauthorizedException if no Authorization header', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const context = createMockContext(undefined);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if Authorization header has no Bearer prefix', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const context = createMockContext('Basic some-token');

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if Bearer token is empty', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const context = createMockContext('Bearer ');

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if JWT verification fails', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    (jwtService.verifyAsync as any).mockRejectedValue(new Error('invalid token'));
    const context = createMockContext('Bearer invalid-jwt-token');

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should attach user payload to request on valid token', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    (jwtService.verifyAsync as any).mockResolvedValue(mockJwtPayload);
    const context = createMockContext('Bearer valid-jwt-token');

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    const request = context.switchToHttp().getRequest();
    expect((request as any).user).toEqual(mockJwtPayload);
  });

  it('should verify token with correct secret from ConfigService', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    (jwtService.verifyAsync as any).mockResolvedValue(mockJwtPayload);
    const context = createMockContext('Bearer valid-jwt-token');

    await guard.canActivate(context);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-jwt-token', {
      secret: 'test-access-secret',
    });
    expect(configService.get).toHaveBeenCalledWith('JWT_ACCESS_SECRET');
  });
});
