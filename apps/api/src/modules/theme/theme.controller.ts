import {
  Controller,
  Get,
  Put,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ThemeService } from './theme.service';
import { UpdateThemeDto } from './dto/update-theme.dto';

/**
 * ThemeController — Provides endpoints for retrieving and updating
 * the white-label theme configuration.
 *
 * - GET /theme/current — Public, serves active theme (polled by frontend every 30s)
 * - PUT /theme/config — Admin only, updates theme configuration
 */
@Controller('theme')
export class ThemeController {
  constructor(private readonly themeService: ThemeService) {}

  /**
   * GET /theme/current
   * Returns the currently active theme configuration.
   * Public endpoint (no auth required) — frontend polls this every 30s.
   * Requirement 10.2: changes applied without server restart.
   */
  @Get('current')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getCurrentTheme() {
    return this.themeService.getCurrentTheme();
  }

  /**
   * PUT /theme/config
   * Update the theme configuration (admin only).
   * Validates input, persists to DB and file, cache is updated immediately.
   * Requirement 10.1: admin configures theme elements.
   */
  @Put('config')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async updateThemeConfig(@Body() dto: UpdateThemeDto) {
    const updated = await this.themeService.updateThemeConfig(dto);
    return {
      message: 'Configuración de tema actualizada exitosamente',
      theme: updated,
    };
  }
}
