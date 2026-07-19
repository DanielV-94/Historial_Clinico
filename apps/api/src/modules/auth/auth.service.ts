import {
  Injectable,
  UnauthorizedException,
  Inject,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';

import { PrismaService } from '../../database/prisma.service';
import { REDIS_CLIENT } from './redis.provider';
import { JwtPayload, JwtRefreshPayload } from './interfaces/jwt-payload.interface';

// Auth constants (from @historial/constants)
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Authenticate a user with username and password.
   * Implements account lockout after MAX_LOGIN_ATTEMPTS failed attempts.
   *
   * @validates Requirements 13.1, 13.4
   */
  async login(username: string, password: string): Promise<TokenPair> {
    // Find user by username
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Check if account is locked
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remainingMs =
        new Date(user.lockedUntil).getTime() - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      throw new UnauthorizedException(
        `Cuenta bloqueada. Intenta de nuevo en ${remainingMinutes} minuto(s).`,
      );
    }

    // Compare password with bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      // Increment failed login attempts
      const newAttempts = user.failedLoginAttempts + 1;
      const updateData: { failedLoginAttempts: number; lockedUntil?: Date } = {
        failedLoginAttempts: newAttempts,
      };

      // Lock account if attempts exceed threshold
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        this.logger.warn(
          `Account locked for user ${username} after ${newAttempts} failed attempts`,
        );
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Successful login: reset failed attempts
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    }

    // Generate token pair
    return this.generateTokens(user);
  }

  /**
   * Refresh an access token using a valid refresh token.
   * Implements token rotation: old token is invalidated, new pair is issued.
   *
   * @validates Requirements 13.1, Design: Token Rotation
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    // Verify JWT signature and decode
    let payload: JwtRefreshPayload;
    try {
      payload = this.jwtService.verify<JwtRefreshPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const { sub: userId, tokenId } = payload;

    // Check if refresh token exists in Redis
    const redisKey = `refresh:${userId}:${tokenId}`;
    const storedToken = await this.redis.get(redisKey);

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token no encontrado o ya fue utilizado');
    }

    // Delete old token from Redis (rotation)
    await this.redis.del(redisKey);

    // Find user to generate new tokens
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    // Generate new token pair
    return this.generateTokens(user);
  }

  /**
   * Logout a user by removing their refresh token from Redis.
   */
  async logout(userId: string, refreshToken: string): Promise<void> {
    try {
      const payload = this.jwtService.verify<JwtRefreshPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const redisKey = `refresh:${userId}:${payload.tokenId}`;
      await this.redis.del(redisKey);
    } catch {
      // If token is invalid/expired, just ignore — user is logging out anyway
      this.logger.debug(`Logout: could not decode refresh token for user ${userId}`);
    }
  }

  /**
   * Generate an access + refresh token pair for a user.
   * Access token: HS256, 15min expiry, payload: { sub, role, username }
   * Refresh token: HS256, 7d expiry, stored in Redis with TTL
   */
  async generateTokens(user: {
    id: string;
    role: string;
    username: string;
  }): Promise<TokenPair> {
    const tokenId = uuidv4();

    // Access token
    const accessPayload: JwtPayload = {
      sub: user.id,
      role: user.role as JwtPayload['role'],
      username: user.username,
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    // Refresh token
    const refreshPayload: JwtRefreshPayload = {
      sub: user.id,
      tokenId,
    };

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: REFRESH_TOKEN_EXPIRY,
    });

    // Store refresh token in Redis with TTL
    const redisKey = `refresh:${user.id}:${tokenId}`;
    await this.redis.set(redisKey, refreshToken, 'EX', REFRESH_TOKEN_TTL_SECONDS);

    return { accessToken, refreshToken };
  }
}
