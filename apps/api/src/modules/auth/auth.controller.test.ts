import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: Partial<AuthService>;
  let mockResponse: Partial<Response>;
  let mockRequest: Partial<Request>;

  beforeEach(() => {
    authService = {
      login: vi.fn(),
      refresh: vi.fn(),
      logout: vi.fn(),
    };

    mockResponse = {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    };

    mockRequest = {
      cookies: {},
    };

    controller = new AuthController(authService as AuthService);
  });

  describe('POST /auth/login', () => {
    it('should return accessToken and set refresh cookie on successful login', async () => {
      const tokenPair = {
        accessToken: 'access-jwt-token',
        refreshToken: 'refresh-jwt-token',
      };
      (authService.login as any).mockResolvedValue(tokenPair);

      const result = await controller.login(
        { username: 'doctor1', password: 'Pass1234' },
        mockResponse as Response,
      );

      expect(result).toEqual({ accessToken: 'access-jwt-token' });
      expect(authService.login).toHaveBeenCalledWith('doctor1', 'Pass1234');
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-jwt-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
        }),
      );
    });

    it('should propagate UnauthorizedException from AuthService', async () => {
      (authService.login as any).mockRejectedValue(
        new UnauthorizedException('Credenciales inválidas'),
      );

      await expect(
        controller.login(
          { username: 'bad', password: 'wrong' },
          mockResponse as Response,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return new accessToken and set new refresh cookie', async () => {
      mockRequest.cookies = { refresh_token: 'old-refresh-token' };
      const newTokenPair = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };
      (authService.refresh as any).mockResolvedValue(newTokenPair);

      const result = await controller.refresh(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(result).toEqual({ accessToken: 'new-access-token' });
      expect(authService.refresh).toHaveBeenCalledWith('old-refresh-token');
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'new-refresh-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
        }),
      );
    });

    it('should throw UnauthorizedException if no refresh cookie present', async () => {
      mockRequest.cookies = {};

      await expect(
        controller.refresh(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if refresh cookie is undefined', async () => {
      mockRequest.cookies = { refresh_token: undefined } as any;

      await expect(
        controller.refresh(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('POST /auth/logout', () => {
    it('should invalidate refresh token and clear cookie', async () => {
      mockRequest.cookies = { refresh_token: 'valid-refresh-token' };
      (authService.logout as any).mockResolvedValue(undefined);

      const user = { sub: 'user-123', role: 'doctor', username: 'doc1' };

      const result = await controller.logout(
        user as any,
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(result).toEqual({ message: 'Sesión cerrada exitosamente' });
      expect(authService.logout).toHaveBeenCalledWith('user-123', 'valid-refresh-token');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
        }),
      );
    });

    it('should clear cookie even if no refresh token is in cookie', async () => {
      mockRequest.cookies = {};
      const user = { sub: 'user-456', role: 'admin', username: 'admin1' };

      const result = await controller.logout(
        user as any,
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(result).toEqual({ message: 'Sesión cerrada exitosamente' });
      expect(authService.logout).not.toHaveBeenCalled();
      expect(mockResponse.clearCookie).toHaveBeenCalled();
    });
  });
});
