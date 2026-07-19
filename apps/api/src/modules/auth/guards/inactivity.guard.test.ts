import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InactivityGuard } from './inactivity.guard';

describe('InactivityGuard', () => {
  let guard: InactivityGuard;
  let reflector: Partial<Reflector>;
  let redis: Record<string, any>;
  let mockContext: Partial<ExecutionContext>;
  let mockRequest: Record<string, any>;

  const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(false),
    };

    redis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
    };

    mockRequest = {
      user: { sub: 'user-123', role: 'doctor', username: 'doc1' },
    };

    mockContext = {
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: () => mockRequest,
      }),
      getHandler: vi.fn(),
      getClass: vi.fn(),
    };

    guard = new InactivityGuard(reflector as Reflector, redis as any);
  });

  it('should allow access for @Public() endpoints', async () => {
    (reflector.getAllAndOverride as any).mockReturnValue(true);

    const result = await guard.canActivate(mockContext as ExecutionContext);

    expect(result).toBe(true);
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('should allow access if no user on request (unauthenticated)', async () => {
    mockRequest.user = undefined;

    const result = await guard.canActivate(mockContext as ExecutionContext);

    expect(result).toBe(true);
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('should allow access and update timestamp if no previous activity recorded', async () => {
    redis.get.mockResolvedValue(null);

    const result = await guard.canActivate(mockContext as ExecutionContext);

    expect(result).toBe(true);
    expect(redis.set).toHaveBeenCalledWith(
      'last_activity:user-123',
      expect.any(String),
      'EX',
      expect.any(Number),
    );
  });

  it('should allow access if last activity is within timeout', async () => {
    const recentActivity = (Date.now() - 5 * 60 * 1000).toString(); // 5 min ago
    redis.get.mockResolvedValue(recentActivity);

    const result = await guard.canActivate(mockContext as ExecutionContext);

    expect(result).toBe(true);
    expect(redis.set).toHaveBeenCalled();
  });

  it('should throw UnauthorizedException if session expired due to inactivity', async () => {
    const oldActivity = (Date.now() - INACTIVITY_TIMEOUT_MS - 1000).toString(); // 15+ min ago
    redis.get.mockResolvedValue(oldActivity);

    await expect(
      guard.canActivate(mockContext as ExecutionContext),
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      guard.canActivate(mockContext as ExecutionContext),
    ).rejects.toThrow('Sesión expirada por inactividad');
  });

  it('should allow access at exactly the timeout boundary', async () => {
    // At exactly 15 minutes, elapsed === INACTIVITY_TIMEOUT_MS, NOT greater than
    const exactBoundary = (Date.now() - INACTIVITY_TIMEOUT_MS).toString();
    redis.get.mockResolvedValue(exactBoundary);

    const result = await guard.canActivate(mockContext as ExecutionContext);

    expect(result).toBe(true);
  });

  it('should expire if even 1ms beyond the timeout', async () => {
    const justBeyond = (Date.now() - INACTIVITY_TIMEOUT_MS - 1).toString();
    redis.get.mockResolvedValue(justBeyond);

    await expect(
      guard.canActivate(mockContext as ExecutionContext),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should set TTL on the redis key for auto-cleanup', async () => {
    redis.get.mockResolvedValue(Date.now().toString());

    await guard.canActivate(mockContext as ExecutionContext);

    const expectedTtl = Math.ceil(INACTIVITY_TIMEOUT_MS / 1000) + 60;
    expect(redis.set).toHaveBeenCalledWith(
      'last_activity:user-123',
      expect.any(String),
      'EX',
      expectedTtl,
    );
  });
});
