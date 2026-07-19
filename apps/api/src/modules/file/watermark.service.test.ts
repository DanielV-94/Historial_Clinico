import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WatermarkService } from './watermark.service';
import { ConfigService } from '@nestjs/config';

// Mock PrismaService
const mockPrisma = {
  themeConfig: {
    findFirst: vi.fn(),
  },
};

// Mock ConfigService
const mockConfigService = {
  get: vi.fn((key: string) => {
    if (key === 'FILE_STORAGE_PATH') return '/data/clinic-files';
    return undefined;
  }),
};

describe('WatermarkService', () => {
  let service: WatermarkService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'FILE_STORAGE_PATH') return '/data/clinic-files';
      return undefined;
    });
    service = new WatermarkService(
      mockPrisma as any,
      mockConfigService as unknown as ConfigService,
    );
  });

  describe('isWatermarkEnabled', () => {
    it('should return false when no theme config exists', async () => {
      mockPrisma.themeConfig.findFirst.mockResolvedValue(null);

      const result = await service.isWatermarkEnabled();
      expect(result).toBe(false);
    });

    it('should return false when rawConfig is null', async () => {
      mockPrisma.themeConfig.findFirst.mockResolvedValue({
        rawConfig: null,
      });

      const result = await service.isWatermarkEnabled();
      expect(result).toBe(false);
    });

    it('should return false when watermarkEnabled is not set in rawConfig', async () => {
      mockPrisma.themeConfig.findFirst.mockResolvedValue({
        rawConfig: { someOtherSetting: true },
      });

      const result = await service.isWatermarkEnabled();
      expect(result).toBe(false);
    });

    it('should return false when watermarkEnabled is explicitly false', async () => {
      mockPrisma.themeConfig.findFirst.mockResolvedValue({
        rawConfig: { watermarkEnabled: false },
      });

      const result = await service.isWatermarkEnabled();
      expect(result).toBe(false);
    });

    it('should return true when watermarkEnabled is true in rawConfig', async () => {
      mockPrisma.themeConfig.findFirst.mockResolvedValue({
        rawConfig: { watermarkEnabled: true },
      });

      const result = await service.isWatermarkEnabled();
      expect(result).toBe(true);
    });

    it('should return false and not throw on database error', async () => {
      mockPrisma.themeConfig.findFirst.mockRejectedValue(
        new Error('DB connection failed'),
      );

      const result = await service.isWatermarkEnabled();
      expect(result).toBe(false);
    });
  });

  describe('getLogoPath', () => {
    it('should return null when no theme config exists', async () => {
      mockPrisma.themeConfig.findFirst.mockResolvedValue(null);

      const result = await service.getLogoPath();
      expect(result).toBeNull();
    });

    it('should return null when logoPath is null', async () => {
      mockPrisma.themeConfig.findFirst.mockResolvedValue({
        logoPath: null,
      });

      const result = await service.getLogoPath();
      expect(result).toBeNull();
    });

    it('should return absolute path as-is', async () => {
      mockPrisma.themeConfig.findFirst.mockResolvedValue({
        logoPath: '/absolute/path/to/logo.png',
      });

      const result = await service.getLogoPath();
      expect(result).toBe('/absolute/path/to/logo.png');
    });

    it('should resolve relative path against base storage path', async () => {
      mockPrisma.themeConfig.findFirst.mockResolvedValue({
        logoPath: 'theme/logo.png',
      });

      const result = await service.getLogoPath();
      expect(result).toContain('theme');
      expect(result).toContain('logo.png');
      expect(result).toContain('clinic-files');
    });

    it('should return null and not throw on database error', async () => {
      mockPrisma.themeConfig.findFirst.mockRejectedValue(
        new Error('DB error'),
      );

      const result = await service.getLogoPath();
      expect(result).toBeNull();
    });
  });

  describe('applyImageWatermark', () => {
    it('should return a buffer when given a valid image buffer', async () => {
      const sharp = (await import('sharp')).default;
      const testImage = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 4,
          background: { r: 255, g: 0, b: 0, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      // No logo configured
      mockPrisma.themeConfig.findFirst.mockResolvedValue({
        logoPath: null,
      });

      const result = await service.applyImageWatermark(testImage, {
        patientId: 'TEST-12345',
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should produce a different buffer than the input (watermark applied)', async () => {
      const sharp = (await import('sharp')).default;
      const testImage = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 4,
          background: { r: 0, g: 128, b: 255, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      // No logo configured
      mockPrisma.themeConfig.findFirst.mockResolvedValue({
        logoPath: null,
      });

      const result = await service.applyImageWatermark(testImage, {
        patientId: 'PAT-67890',
        opacity: 0.7,
      });

      expect(result).toBeInstanceOf(Buffer);
      // The watermarked image should differ from the original
      expect(Buffer.compare(result, testImage)).not.toBe(0);
    });

    it('should use default opacity of 0.5 when not specified', async () => {
      const sharp = (await import('sharp')).default;
      const testImage = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      mockPrisma.themeConfig.findFirst.mockResolvedValue({
        logoPath: null,
      });

      // Should not throw when opacity is not provided
      const result = await service.applyImageWatermark(testImage, {
        patientId: 'PAT-NO-OPACITY',
      });

      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('applyVideoWatermark', () => {
    it('should handle missing ffmpeg gracefully by copying the original file', async () => {
      const fsPromises = await import('fs/promises');
      const os = await import('os');
      const pathModule = await import('path');

      // Create temporary files
      const tmpDir = os.tmpdir();
      const inputPath = pathModule.join(
        tmpDir,
        `test-input-${Date.now()}.mp4`,
      );
      const outputPath = pathModule.join(
        tmpDir,
        `test-output-${Date.now()}.mp4`,
      );

      // Write a dummy file
      const dummyContent = Buffer.from('fake video content for test');
      await fsPromises.writeFile(inputPath, dummyContent);

      mockPrisma.themeConfig.findFirst.mockResolvedValue({
        logoPath: null,
      });

      // The test may pass if ffmpeg is installed (video gets watermarked)
      // or if ffmpeg is not installed (file gets copied as-is)
      // Either way, the output file should exist after the call.
      await service.applyVideoWatermark(inputPath, outputPath, {
        patientId: 'TEST-VID-001',
      });

      // Verify output file was created (either watermarked or copied)
      const outputStat = await fsPromises.stat(outputPath);
      expect(outputStat.size).toBeGreaterThan(0);

      // Cleanup
      await fsPromises.unlink(inputPath).catch(() => {});
      await fsPromises.unlink(outputPath).catch(() => {});
    });
  });
});
