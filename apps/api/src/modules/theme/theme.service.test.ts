import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { ThemeService } from './theme.service';
import { PrismaService } from '../../database/prisma.service';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  watch: vi.fn(() => ({ close: vi.fn() })),
}));

import * as fs from 'fs';

/**
 * Unit tests for ThemeService.
 * Validates: Requirements 10.1, 10.2, 10.4
 */
describe('ThemeService', () => {
  let service: ThemeService;

  const mockPrismaService = {
    themeConfig: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    clinic: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  };

  const mockConfigService = {
    get: vi.fn((key: string, defaultValue?: string) => {
      const configs: Record<string, string> = {
        THEME_CONFIG_PATH: './config/theme-test.json',
      };
      return configs[key] || defaultValue;
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default fs mocks - file doesn't exist
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.watch).mockReturnValue({ close: vi.fn() } as unknown as ReturnType<typeof fs.watch>);

    service = new ThemeService(
      mockPrismaService as unknown as PrismaService,
      mockConfigService as unknown as ConfigService,
    );
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  describe('getCurrentTheme', () => {
    it('should return default theme when no config exists', async () => {
      mockPrismaService.themeConfig.findFirst.mockResolvedValue(null);

      await service.onModuleInit();
      const theme = await service.getCurrentTheme();

      expect(theme).toBeDefined();
      expect(theme.clinicName).toBe('Clínica');
      expect(theme.primaryColor).toBe('#2563EB');
      expect(theme.secondaryColor).toBe('#1E40AF');
      expect(theme.accentColor).toBe('#3B82F6');
      expect(theme.fontFamily).toBe('Inter');
      expect(theme.darkMode).toBe(false);
    });

    it('should load theme from database when no file exists', async () => {
      const dbRecord = {
        id: 'test-id',
        clinicId: 'clinic-1',
        clinicName: 'Mi Clínica',
        logoPath: '/logos/logo.png',
        primaryColor: '#FF0000',
        secondaryColor: '#00FF00',
        accentColor: '#0000FF',
        fontFamily: 'Roboto',
        rawConfig: { darkMode: true },
        updatedAt: new Date(),
      };

      mockPrismaService.themeConfig.findFirst.mockResolvedValue(dbRecord);

      await service.onModuleInit();
      const theme = await service.getCurrentTheme();

      expect(theme.clinicName).toBe('Mi Clínica');
      expect(theme.logoUrl).toBe('/logos/logo.png');
      expect(theme.primaryColor).toBe('#FF0000');
      expect(theme.darkMode).toBe(true);
    });

    it('should load theme from JSON file when file exists', async () => {
      const fileTheme = {
        clinicName: 'Clínica del Archivo',
        logoUrl: '/logo.svg',
        primaryColor: '#AABBCC',
        secondaryColor: '#DDEEFF',
        accentColor: '#112233',
        fontFamily: 'Arial',
        darkMode: false,
      };

      vi.mocked(fs.existsSync).mockImplementation((p: unknown) => {
        const filePath = typeof p === 'string' ? p : String(p);
        return filePath.includes('theme');
      });
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(fileTheme));

      mockPrismaService.clinic.findFirst.mockResolvedValue({ id: 'clinic-1' });
      mockPrismaService.themeConfig.upsert.mockResolvedValue({});

      await service.onModuleInit();
      const theme = await service.getCurrentTheme();

      expect(theme.clinicName).toBe('Clínica del Archivo');
      expect(theme.primaryColor).toBe('#AABBCC');
      expect(theme.fontFamily).toBe('Arial');
    });
  });

  describe('updateThemeConfig', () => {
    it('should update theme and persist to DB and file', async () => {
      mockPrismaService.themeConfig.findFirst.mockResolvedValue(null);
      mockPrismaService.clinic.findFirst.mockResolvedValue({ id: 'clinic-1' });
      mockPrismaService.themeConfig.upsert.mockResolvedValue({});

      await service.onModuleInit();

      const result = await service.updateThemeConfig({
        clinicName: 'Nueva Clínica',
        primaryColor: '#FF5500',
      });

      expect(result.clinicName).toBe('Nueva Clínica');
      expect(result.primaryColor).toBe('#FF5500');
      // Should keep defaults for non-updated fields
      expect(result.secondaryColor).toBe('#1E40AF');
      expect(result.fontFamily).toBe('Inter');

      // Should persist to database
      expect(mockPrismaService.themeConfig.upsert).toHaveBeenCalled();
    });

    it('should merge partial updates with current config', async () => {
      const dbRecord = {
        id: 'test-id',
        clinicId: 'clinic-1',
        clinicName: 'Original',
        logoPath: '/logo.png',
        primaryColor: '#111111',
        secondaryColor: '#222222',
        accentColor: '#333333',
        fontFamily: 'Helvetica',
        rawConfig: { darkMode: false },
        updatedAt: new Date(),
      };

      mockPrismaService.themeConfig.findFirst.mockResolvedValue(dbRecord);
      mockPrismaService.clinic.findFirst.mockResolvedValue({ id: 'clinic-1' });
      mockPrismaService.themeConfig.upsert.mockResolvedValue({});

      await service.onModuleInit();

      const result = await service.updateThemeConfig({
        darkMode: true,
      });

      // Only darkMode should change
      expect(result.darkMode).toBe(true);
      expect(result.clinicName).toBe('Original');
      expect(result.primaryColor).toBe('#111111');
      expect(result.fontFamily).toBe('Helvetica');
    });
  });

  describe('validateLogoFile', () => {
    it('should accept valid PNG files under 2MB', () => {
      const result = service.validateLogoFile('image/png', 1024 * 1024);
      expect(result.valid).toBe(true);
    });

    it('should accept valid SVG files under 2MB', () => {
      const result = service.validateLogoFile('image/svg+xml', 500 * 1024);
      expect(result.valid).toBe(true);
    });

    it('should reject non-PNG/SVG files', () => {
      const result = service.validateLogoFile('image/jpeg', 1024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('PNG o SVG');
    });

    it('should reject files over 2MB', () => {
      const result = service.validateLogoFile('image/png', 3 * 1024 * 1024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('2 MB');
    });
  });

  describe('fallback to defaults (Req 10.4)', () => {
    it('should use default values when config has invalid hex colors', async () => {
      const invalidFileTheme = {
        clinicName: 'Valid Name',
        primaryColor: 'not-a-hex',
        secondaryColor: '#DDEEFF',
        accentColor: 'invalid',
        fontFamily: 'Valid Font',
      };

      vi.mocked(fs.existsSync).mockImplementation((p: unknown) => {
        const filePath = typeof p === 'string' ? p : String(p);
        return filePath.includes('theme');
      });
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(invalidFileTheme));

      mockPrismaService.clinic.findFirst.mockResolvedValue({ id: 'clinic-1' });
      mockPrismaService.themeConfig.upsert.mockResolvedValue({});

      await service.onModuleInit();
      const theme = await service.getCurrentTheme();

      // Valid fields kept
      expect(theme.clinicName).toBe('Valid Name');
      expect(theme.secondaryColor).toBe('#DDEEFF');
      expect(theme.fontFamily).toBe('Valid Font');

      // Invalid fields get defaults
      expect(theme.primaryColor).toBe('#2563EB');
      expect(theme.accentColor).toBe('#3B82F6');
    });

    it('should use all defaults when JSON file is malformed', async () => {
      vi.mocked(fs.existsSync).mockImplementation((p: unknown) => {
        const filePath = typeof p === 'string' ? p : String(p);
        return filePath.includes('theme');
      });
      vi.mocked(fs.readFileSync).mockReturnValue('{ invalid json content !!!');

      mockPrismaService.themeConfig.findFirst.mockResolvedValue(null);

      await service.onModuleInit();
      const theme = await service.getCurrentTheme();

      expect(theme.clinicName).toBe('Clínica');
      expect(theme.primaryColor).toBe('#2563EB');
    });
  });
});
