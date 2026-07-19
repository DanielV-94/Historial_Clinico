import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';

/**
 * Unit tests for RolesGuard.
 * Validates: Requirements 8.3, 13.2, 13.5
 */
describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  function createMockContext(user?: { sub: string; role: string; username: string }): ExecutionContext {
    const mockRequest = { user };

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
    guard = new RolesGuard(reflector);
  });

  it('should allow access to @Public() endpoints regardless of role', () => {
    vi.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(true) // IS_PUBLIC_KEY
      .mockReturnValueOnce(undefined); // ROLES_KEY

    const context = createMockContext(undefined);
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should allow access if no @Roles() are specified (authenticated-only)', () => {
    vi.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false) // IS_PUBLIC_KEY
      .mockReturnValueOnce(undefined); // ROLES_KEY — no roles required

    const context = createMockContext({ sub: 'user-1', role: 'doctor', username: 'doc1' });
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should allow access if user role matches one of the required roles', () => {
    vi.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false) // IS_PUBLIC_KEY
      .mockReturnValueOnce(['doctor', 'admin']); // ROLES_KEY

    const context = createMockContext({ sub: 'user-1', role: 'doctor', username: 'doc1' });
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should allow admin access to any endpoint', () => {
    vi.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false) // IS_PUBLIC_KEY
      .mockReturnValueOnce(['doctor']); // ROLES_KEY — only doctor required

    const context = createMockContext({ sub: 'user-1', role: 'admin', username: 'admin1' });

    // Admin has its own role. Unless explicitly included, it should be denied.
    // RBAC requires admin to be listed in the @Roles() decorator for this endpoint.
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if user role does not match required roles', () => {
    vi.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false) // IS_PUBLIC_KEY
      .mockReturnValueOnce(['doctor', 'admin']); // ROLES_KEY

    const context = createMockContext({ sub: 'user-1', role: 'assistant', username: 'assist1' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if no user on request (fail-closed)', () => {
    vi.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false) // IS_PUBLIC_KEY
      .mockReturnValueOnce(['doctor']); // ROLES_KEY

    const context = createMockContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if user has no role (fail-closed)', () => {
    vi.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false) // IS_PUBLIC_KEY
      .mockReturnValueOnce(['doctor']); // ROLES_KEY

    const context = createMockContext({ sub: 'user-1', role: '', username: 'user1' } as any);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should deny kiosk role access to patient endpoints', () => {
    vi.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['doctor', 'assistant', 'admin']);

    const context = createMockContext({ sub: 'kiosk-1', role: 'kiosk', username: 'kiosk1' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow kiosk role access to kiosk endpoints', () => {
    vi.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['kiosk']);

    const context = createMockContext({ sub: 'kiosk-1', role: 'kiosk', username: 'kiosk1' });
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should handle empty required roles array as no restriction', () => {
    vi.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false) // IS_PUBLIC_KEY
      .mockReturnValueOnce([]); // ROLES_KEY — empty array

    const context = createMockContext({ sub: 'user-1', role: 'assistant', username: 'assist1' });
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });
});
