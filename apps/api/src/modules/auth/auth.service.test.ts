import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
  },
  compare: vi.fn(),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'mock-uuid-token-id',
}));

import * as bcrypt from 'bcrypt';

/**
 * Unit tests for AuthService.
 * Validates: Requirements 13.1, 13.4
 */
describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: any;
  let jwtService: any;
  let configService: any;
  let redisClient: any;

  const mockUser = {
    id: 'user-123',
    username: 'doctor1',
    passwordHash: '$2b$12$hashedpassword',
    role: 'doctor',
    fullName: 'Dr. Smith',
    email: 'doctor@clinic.com',
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prismaService = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    jwtService = {
      sign: vi.fn().mockReturnValue('mock-jwt-token'),
      verify: vi.fn(),
    };

    configService = {
      get: vi.fn((key: string) => {
        const config: Record<string, string> = {
          JWT_ACCESS_SECRET: 'test-access-secret',
          JWT_REFRESH_SECRET: 'test-refresh-secret',
        };
        return config[key];
      }),
    };

    redisClient = {
      set: vi.fn().mockResolvedValue('OK'),
      get: vi.fn(),
      del: vi.fn().mockResolvedValue(1),
    };

    authService = new AuthService(
      prismaService as any,
      jwtService as JwtService,
      configService as ConfigService,
      redisClient,
    );
  });

  describe('login', () => {
    it('should authenticate a valid user and return tokens', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(true);

      const result = await authService.login('doctor1', 'ValidPass1');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(redisClient.set).toHaveBeenCalledWith(
        expect.stringMatching(/^refresh:user-123:/),
        expect.any(String),
        'EX',
        604800,
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login('nonexistent', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(
        authService.login('doctor1', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if account is locked', async () => {
      const lockedUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
      };
      prismaService.user.findUnique.mockResolvedValue(lockedUser);

      await expect(
        authService.login('doctor1', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should include remaining lockout time in error message', async () => {
      const lockedUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
      };
      prismaService.user.findUnique.mockResolvedValue(lockedUser);

      try {
        await authService.login('doctor1', 'password');
      } catch (error) {
        expect((error as UnauthorizedException).message).toContain('minuto');
      }
    });

    it('should increment failedLoginAttempts on wrong password', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(false);
      prismaService.user.update.mockResolvedValue(mockUser);

      await expect(
        authService.login('doctor1', 'wrongpass'),
      ).rejects.toThrow(UnauthorizedException);

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { failedLoginAttempts: 1 },
      });
    });

    it('should lock account after 5 failed attempts', async () => {
      const userWith4Fails = { ...mockUser, failedLoginAttempts: 4 };
      prismaService.user.findUnique.mockResolvedValue(userWith4Fails);
      (bcrypt.compare as any).mockResolvedValue(false);
      prismaService.user.update.mockResolvedValue(userWith4Fails);

      await expect(
        authService.login('doctor1', 'wrongpass'),
      ).rejects.toThrow(UnauthorizedException);

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          failedLoginAttempts: 5,
          lockedUntil: expect.any(Date),
        },
      });
    });

    it('should reset failedLoginAttempts on successful login', async () => {
      const userWithFails = { ...mockUser, failedLoginAttempts: 3 };
      prismaService.user.findUnique.mockResolvedValue(userWithFails);
      (bcrypt.compare as any).mockResolvedValue(true);
      prismaService.user.update.mockResolvedValue(userWithFails);

      await authService.login('doctor1', 'CorrectPass1');

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    });

    it('should allow login if lockout period has expired', async () => {
      const expiredLockUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() - 1000), // 1 second ago
        failedLoginAttempts: 5,
      };
      prismaService.user.findUnique.mockResolvedValue(expiredLockUser);
      (bcrypt.compare as any).mockResolvedValue(true);
      prismaService.user.update.mockResolvedValue(expiredLockUser);

      const result = await authService.login('doctor1', 'CorrectPass1');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('refresh', () => {
    it('should rotate tokens on valid refresh', async () => {
      const mockPayload = { sub: 'user-123', tokenId: 'old-token-id' };
      jwtService.verify.mockReturnValue(mockPayload);
      redisClient.get.mockResolvedValue('stored-refresh-token');
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.refresh('valid-refresh-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      // Old token should be deleted
      expect(redisClient.del).toHaveBeenCalledWith('refresh:user-123:old-token-id');
      // New token should be stored
      expect(redisClient.set).toHaveBeenCalled();
    });

    it('should throw if refresh token JWT is invalid', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(
        authService.refresh('invalid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if refresh token not found in Redis', async () => {
      const mockPayload = { sub: 'user-123', tokenId: 'token-id' };
      jwtService.verify.mockReturnValue(mockPayload);
      redisClient.get.mockResolvedValue(null);

      await expect(
        authService.refresh('expired-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if user is not found or inactive', async () => {
      const mockPayload = { sub: 'user-123', tokenId: 'token-id' };
      jwtService.verify.mockReturnValue(mockPayload);
      redisClient.get.mockResolvedValue('stored-token');
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.refresh('token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should remove refresh token from Redis', async () => {
      const mockPayload = { sub: 'user-123', tokenId: 'token-id' };
      jwtService.verify.mockReturnValue(mockPayload);

      await authService.logout('user-123', 'refresh-token');

      expect(redisClient.del).toHaveBeenCalledWith('refresh:user-123:token-id');
    });

    it('should not throw if token is invalid on logout', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('expired');
      });

      // Should not throw
      await expect(
        authService.logout('user-123', 'invalid-token'),
      ).resolves.toBeUndefined();
    });
  });

  describe('generateTokens', () => {
    it('should create access token with correct payload', async () => {
      const tokens = await authService.generateTokens({
        id: 'user-123',
        role: 'doctor',
        username: 'doctor1',
      });

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 'user-123', role: 'doctor', username: 'doctor1' },
        { secret: 'test-access-secret', expiresIn: '15m' },
      );
      expect(tokens.accessToken).toBe('mock-jwt-token');
    });

    it('should create refresh token and store in Redis with TTL', async () => {
      await authService.generateTokens({
        id: 'user-123',
        role: 'admin',
        username: 'admin1',
      });

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 'user-123', tokenId: 'mock-uuid-token-id' },
        { secret: 'test-refresh-secret', expiresIn: '7d' },
      );
      expect(redisClient.set).toHaveBeenCalledWith(
        'refresh:user-123:mock-uuid-token-id',
        'mock-jwt-token',
        'EX',
        604800, // 7 days in seconds
      );
    });
  });
});
