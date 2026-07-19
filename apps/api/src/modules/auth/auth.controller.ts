import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';

/** Cookie configuration for refresh token */
const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/login
   * Authenticates user with username + password.
   * Returns access token in body, sets refresh token as httpOnly cookie.
   *
   * @validates Requirements 13.1, 13.4
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(
      loginDto.username,
      loginDto.password,
    );

    this.setRefreshCookie(response, refreshToken);

    return { accessToken };
  }

  /**
   * POST /auth/refresh
   * Renews access token using refresh token from httpOnly cookie.
   * Implements token rotation — old refresh token is invalidated.
   *
   * @validates Requirements 13.1
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token no proporcionado');
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refresh(refreshToken);

    this.setRefreshCookie(response, newRefreshToken);

    return { accessToken };
  }

  /**
   * POST /auth/logout
   * Invalidates the refresh token in Redis and clears the cookie.
   * Requires authentication (protected by global JwtAuthGuard).
   *
   * @validates Requirements 13.3
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: JwtPayload,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.[REFRESH_COOKIE_NAME];

    if (refreshToken) {
      await this.authService.logout(user.sub, refreshToken);
    }

    this.clearRefreshCookie(response);

    return { message: 'Sesión cerrada exitosamente' };
  }

  /**
   * Sets the refresh token as an httpOnly, secure, sameSite strict cookie.
   */
  private setRefreshCookie(response: Response, refreshToken: string): void {
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      path: '/',
    });
  }

  /**
   * Clears the refresh token cookie.
   */
  private clearRefreshCookie(response: Response): void {
    response.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }
}
