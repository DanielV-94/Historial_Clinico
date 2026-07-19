import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../database/prisma.service';
import { themeConfigSchema, DEFAULT_THEME } from '@historial/validators';
import type { ThemeConfig } from '@historial/shared-types';
import { UpdateThemeDto } from './dto/update-theme.dto';

/**
 * ThemeService — Reads/validates JSON theme config, stores in DB,
 * implements hot-reload via file watching, and provides fallback defaults.
 *
 * Requirements: 10.1, 10.2, 10.4
 */
@Injectable()
export class ThemeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ThemeService.name);
  private readonly configFilePath: string;
  private fileWatcher: fs.FSWatcher | null = null;
  private cachedTheme: ThemeConfig | null = null;

  /** Default theme used as fallback when config is invalid (Req 10.4) */
  private readonly defaultTheme: ThemeConfig = {
    clinicName: DEFAULT_THEME.clinicName,
    logoUrl: '',
    primaryColor: DEFAULT_THEME.primaryColor,
    secondaryColor: DEFAULT_THEME.secondaryColor,
    accentColor: DEFAULT_THEME.accentColor,
    fontFamily: DEFAULT_THEME.fontFamily,
    darkMode: false,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.configFilePath = this.configService.get<string>(
      'THEME_CONFIG_PATH',
      './config/theme.json',
    );
  }

  async onModuleInit(): Promise<void> {
    await this.loadThemeConfig();
    this.startFileWatcher();
  }

  onModuleDestroy(): void {
    this.stopFileWatcher();
  }

  /**
   * Get the current active theme configuration.
   * Serves from cache for performance; falls back to DB then defaults.
   */
  async getCurrentTheme(): Promise<ThemeConfig> {
    if (this.cachedTheme) {
      return this.cachedTheme;
    }

    // Try loading from database
    const dbTheme = await this.loadFromDatabase();
    if (dbTheme) {
      this.cachedTheme = dbTheme;
      return dbTheme;
    }

    // Return defaults
    return this.defaultTheme;
  }

  /**
   * Update theme configuration. Validates input, persists to DB and JSON file.
   * Requirement 10.1 (admin configures), 10.2 (hot-reload)
   */
  async updateThemeConfig(dto: UpdateThemeDto): Promise<ThemeConfig> {
    const currentTheme = await this.getCurrentTheme();

    // Merge updates into current config
    const updatedConfig: ThemeConfig = {
      clinicName: dto.clinicName ?? currentTheme.clinicName,
      logoUrl: dto.logoUrl ?? currentTheme.logoUrl,
      primaryColor: dto.primaryColor ?? currentTheme.primaryColor,
      secondaryColor: dto.secondaryColor ?? currentTheme.secondaryColor,
      accentColor: dto.accentColor ?? currentTheme.accentColor,
      fontFamily: dto.fontFamily ?? currentTheme.fontFamily,
      darkMode: dto.darkMode ?? currentTheme.darkMode,
    };

    // Validate merged config
    const validation = this.validateThemeConfig(updatedConfig);
    if (!validation.valid) {
      this.logger.warn(
        `Theme config validation failed: ${validation.errors.join(', ')}. Using defaults for invalid fields.`,
      );
    }

    // Persist to database
    await this.persistToDatabase(updatedConfig);

    // Persist to JSON file (for hot-reload by other instances)
    this.persistToFile(updatedConfig);

    // Update cache
    this.cachedTheme = updatedConfig;

    this.logger.log('Theme configuration updated successfully');
    return updatedConfig;
  }

  /**
   * Load theme config from JSON file and/or database.
   * Implements fallback to defaults if config is invalid (Req 10.4).
   */
  private async loadThemeConfig(): Promise<void> {
    // Try loading from JSON file first
    const fileTheme = this.loadFromFile();
    if (fileTheme) {
      // Sync file config to database
      await this.persistToDatabase(fileTheme);
      this.cachedTheme = fileTheme;
      this.logger.log('Theme loaded from configuration file');
      return;
    }

    // Fall back to database
    const dbTheme = await this.loadFromDatabase();
    if (dbTheme) {
      this.cachedTheme = dbTheme;
      this.logger.log('Theme loaded from database');
      return;
    }

    // Use defaults
    this.cachedTheme = this.defaultTheme;
    this.logger.log('Using default theme configuration');
  }

  /**
   * Read and validate JSON theme from file.
   * Returns null if file doesn't exist or is invalid (with fallback logging).
   */
  private loadFromFile(): ThemeConfig | null {
    try {
      const absolutePath = path.resolve(this.configFilePath);

      if (!fs.existsSync(absolutePath)) {
        this.logger.log(`Theme config file not found at: ${absolutePath}`);
        return null;
      }

      const fileContent = fs.readFileSync(absolutePath, 'utf-8');
      const rawConfig = JSON.parse(fileContent);

      // Validate with shared schema
      const validation = this.validateThemeConfig(rawConfig);

      if (!validation.valid) {
        this.logger.warn(
          `Theme config file contains invalid values: ${validation.errors.join(', ')}. Falling back to defaults. (Req 10.4)`,
        );
        return this.applyFallbackDefaults(rawConfig);
      }

      // Map to ThemeConfig interface
      return this.mapToThemeConfig(rawConfig);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Failed to read theme config file: ${errorMsg}. Using defaults. (Req 10.4)`,
      );
      return null;
    }
  }

  /**
   * Load theme from database (ThemeConfig model via Prisma).
   */
  private async loadFromDatabase(): Promise<ThemeConfig | null> {
    try {
      const record = await this.prisma.themeConfig.findFirst({
        orderBy: { updatedAt: 'desc' },
      });

      if (!record) {
        return null;
      }

      return {
        clinicName: record.clinicName,
        logoUrl: record.logoPath || '',
        primaryColor: record.primaryColor,
        secondaryColor: record.secondaryColor,
        accentColor: record.accentColor,
        fontFamily: record.fontFamily,
        darkMode: (record.rawConfig as Record<string, unknown>)?.darkMode === true,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to load theme from database: ${errorMsg}`);
      return null;
    }
  }

  /**
   * Persist theme config to the database (upsert).
   */
  private async persistToDatabase(config: ThemeConfig): Promise<void> {
    try {
      // Find the first clinic (or create one if none exists)
      let clinic = await this.prisma.clinic.findFirst();
      if (!clinic) {
        clinic = await this.prisma.clinic.create({
          data: {
            name: config.clinicName,
            address: '',
            phone: '',
          },
        });
      }

      await this.prisma.themeConfig.upsert({
        where: { clinicId: clinic.id },
        update: {
          clinicName: config.clinicName,
          logoPath: config.logoUrl || null,
          primaryColor: config.primaryColor,
          secondaryColor: config.secondaryColor,
          accentColor: config.accentColor,
          fontFamily: config.fontFamily,
          rawConfig: { darkMode: config.darkMode },
        },
        create: {
          clinicId: clinic.id,
          clinicName: config.clinicName,
          logoPath: config.logoUrl || null,
          primaryColor: config.primaryColor,
          secondaryColor: config.secondaryColor,
          accentColor: config.accentColor,
          fontFamily: config.fontFamily,
          rawConfig: { darkMode: config.darkMode },
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to persist theme to database: ${errorMsg}`);
    }
  }

  /**
   * Write theme config to JSON file for hot-reload.
   */
  private persistToFile(config: ThemeConfig): void {
    try {
      const absolutePath = path.resolve(this.configFilePath);
      const dir = path.dirname(absolutePath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const jsonContent = JSON.stringify(config, null, 2);
      fs.writeFileSync(absolutePath, jsonContent, 'utf-8');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to write theme config to file: ${errorMsg}`);
    }
  }

  /**
   * Validate theme config using the shared Zod schema.
   * Returns { valid, errors } result.
   */
  private validateThemeConfig(config: unknown): { valid: boolean; errors: string[] } {
    // Build a validation-compatible object
    const validationTarget = {
      clinicName: (config as Record<string, unknown>)?.clinicName,
      primaryColor: (config as Record<string, unknown>)?.primaryColor,
      secondaryColor: (config as Record<string, unknown>)?.secondaryColor,
      accentColor: (config as Record<string, unknown>)?.accentColor,
      fontFamily: (config as Record<string, unknown>)?.fontFamily,
    };

    const result = themeConfigSchema.safeParse(validationTarget);

    if (result.success) {
      return { valid: true, errors: [] };
    }

    const errors = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    return { valid: false, errors };
  }

  /**
   * Validate logo file constraints: PNG/SVG, ≤2MB.
   */
  validateLogoFile(mimeType: string, sizeBytes: number): { valid: boolean; error?: string } {
    const allowedMimes = ['image/png', 'image/svg+xml'];
    const maxSize = 2 * 1024 * 1024; // 2MB

    if (!allowedMimes.includes(mimeType)) {
      return { valid: false, error: 'El logo debe ser formato PNG o SVG' };
    }

    if (sizeBytes > maxSize) {
      return { valid: false, error: 'El logo no puede exceder 2 MB' };
    }

    return { valid: true };
  }

  /**
   * Apply fallback defaults for invalid fields while keeping valid ones.
   * Requirement 10.4: Use default values for invalid fields.
   */
  private applyFallbackDefaults(rawConfig: Record<string, unknown>): ThemeConfig {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;

    const clinicName =
      typeof rawConfig.clinicName === 'string' && rawConfig.clinicName.length > 0
        ? rawConfig.clinicName
        : this.defaultTheme.clinicName;

    const primaryColor =
      typeof rawConfig.primaryColor === 'string' && hexRegex.test(rawConfig.primaryColor)
        ? rawConfig.primaryColor
        : this.defaultTheme.primaryColor;

    const secondaryColor =
      typeof rawConfig.secondaryColor === 'string' && hexRegex.test(rawConfig.secondaryColor)
        ? rawConfig.secondaryColor
        : this.defaultTheme.secondaryColor;

    const accentColor =
      typeof rawConfig.accentColor === 'string' && hexRegex.test(rawConfig.accentColor)
        ? rawConfig.accentColor
        : this.defaultTheme.accentColor;

    const fontFamily =
      typeof rawConfig.fontFamily === 'string' && rawConfig.fontFamily.length > 0
        ? rawConfig.fontFamily
        : this.defaultTheme.fontFamily;

    const logoUrl =
      typeof rawConfig.logoUrl === 'string' ? rawConfig.logoUrl : this.defaultTheme.logoUrl;

    const darkMode =
      typeof rawConfig.darkMode === 'boolean' ? rawConfig.darkMode : this.defaultTheme.darkMode;

    return {
      clinicName,
      logoUrl,
      primaryColor,
      secondaryColor,
      accentColor,
      fontFamily,
      darkMode,
    };
  }

  /**
   * Map raw JSON data to ThemeConfig interface.
   */
  private mapToThemeConfig(raw: Record<string, unknown>): ThemeConfig {
    return {
      clinicName: raw.clinicName as string,
      logoUrl: (raw.logoUrl as string) || '',
      primaryColor: raw.primaryColor as string,
      secondaryColor: raw.secondaryColor as string,
      accentColor: raw.accentColor as string,
      fontFamily: raw.fontFamily as string,
      darkMode: raw.darkMode === true,
    };
  }

  /**
   * Start watching the theme config file for changes (hot-reload).
   * Requirement 10.2: Apply changes without server restart.
   */
  private startFileWatcher(): void {
    try {
      const absolutePath = path.resolve(this.configFilePath);
      const dir = path.dirname(absolutePath);

      // Ensure directory exists before watching
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Create the file if it doesn't exist (so watcher can observe it)
      if (!fs.existsSync(absolutePath)) {
        this.persistToFile(this.cachedTheme || this.defaultTheme);
      }

      this.fileWatcher = fs.watch(absolutePath, (eventType) => {
        if (eventType === 'change') {
          this.handleFileChange();
        }
      });

      this.logger.log(`File watcher started for: ${absolutePath}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to start file watcher: ${errorMsg}. Hot-reload disabled.`);
    }
  }

  /**
   * Handle file change event — reload and validate config.
   * Implements debounce to avoid multiple rapid reloads.
   */
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  private handleFileChange(): void {
    // Debounce: wait 500ms after last change event
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      this.logger.log('Theme config file changed, reloading...');
      const newTheme = this.loadFromFile();

      if (newTheme) {
        this.cachedTheme = newTheme;
        await this.persistToDatabase(newTheme);
        this.logger.log('Theme config hot-reloaded successfully (Req 10.2)');
      } else {
        this.logger.warn('File change detected but config is invalid. Keeping current theme.');
      }
    }, 500);
  }

  /**
   * Stop the file watcher (cleanup on module destroy).
   */
  private stopFileWatcher(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}
