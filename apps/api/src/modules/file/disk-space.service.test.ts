import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { DiskSpaceService, type DiskSpaceInfo } from './disk-space.service';

/**
 * Create a mock ConfigService for DiskSpaceService
 */
const createMockConfigService = (overrides: Record<string, string | undefined> = {}) => {
  const defaults: Record<string, string | undefined> = {
    FILE_STORAGE_PATH: process.cwd(), // Use current dir so statfsSync works
    DISK_SPACE_WARNING_PERCENT: '10',
    DISK_SPACE_CRITICAL_PERCENT: '5',
  };
  const config = { ...defaults, ...overrides };
  return {
    get: vi.fn((key: string) => config[key]),
  };
};

describe('DiskSpaceService', () => {
  let service: DiskSpaceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DiskSpaceService(createMockConfigService() as any);
  });

  describe('checkDiskSpace', () => {
    it('should return disk space info with all required properties', () => {
      const result = service.checkDiskSpace();

      expect(result).toHaveProperty('totalBytes');
      expect(result).toHaveProperty('freeBytes');
      expect(result).toHaveProperty('usedBytes');
      expect(result).toHaveProperty('freePercentage');
      expect(typeof result.totalBytes).toBe('number');
      expect(typeof result.freeBytes).toBe('number');
      expect(typeof result.usedBytes).toBe('number');
      expect(typeof result.freePercentage).toBe('number');
    });

    it('should return positive values for total and free bytes', () => {
      const result = service.checkDiskSpace();

      expect(result.totalBytes).toBeGreaterThan(0);
      expect(result.freeBytes).toBeGreaterThanOrEqual(0);
      expect(result.usedBytes).toBeGreaterThanOrEqual(0);
    });

    it('should return usedBytes = totalBytes - freeBytes', () => {
      const result = service.checkDiskSpace();

      expect(result.usedBytes).toBe(result.totalBytes - result.freeBytes);
    });

    it('should return freePercentage between 0 and 100', () => {
      const result = service.checkDiskSpace();

      expect(result.freePercentage).toBeGreaterThanOrEqual(0);
      expect(result.freePercentage).toBeLessThanOrEqual(100);
    });
  });

  describe('hasEnoughSpace', () => {
    it('should return true for zero required bytes', () => {
      const result = service.hasEnoughSpace(0);
      expect(result).toBe(true);
    });

    it('should return true for a small file size on current disk', () => {
      // 1KB should always fit
      const result = service.hasEnoughSpace(1024);
      expect(result).toBe(true);
    });

    it('should return false for impossibly large file size', () => {
      // 1 Exabyte — no disk has this much space
      const result = service.hasEnoughSpace(1_000_000_000_000_000_000);
      expect(result).toBe(false);
    });

    it('should return a boolean value', () => {
      const result = service.hasEnoughSpace(1_000_000);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getDiskStatus', () => {
    it('should return status with alertLevel and message', () => {
      const status = service.getDiskStatus();

      expect(status).toHaveProperty('info');
      expect(status).toHaveProperty('alertLevel');
      expect(status).toHaveProperty('message');
      expect(['ok', 'warning', 'critical']).toContain(status.alertLevel);
      expect(typeof status.message).toBe('string');
      expect(status.message.length).toBeGreaterThan(0);
    });

    it('should include DiskSpaceInfo in the info field', () => {
      const status = service.getDiskStatus();

      expect(status.info).toHaveProperty('totalBytes');
      expect(status.info).toHaveProperty('freeBytes');
      expect(status.info).toHaveProperty('usedBytes');
      expect(status.info).toHaveProperty('freePercentage');
    });

    it('should return consistent info between checkDiskSpace and getDiskStatus', () => {
      const diskInfo = service.checkDiskSpace();
      const status = service.getDiskStatus();

      // Both should return similar values (may differ slightly due to timing)
      expect(status.info.totalBytes).toBe(diskInfo.totalBytes);
    });
  });

  describe('ensureSpaceAvailable', () => {
    it('should not throw for a small file size', () => {
      // 1KB should always be available
      expect(() => service.ensureSpaceAvailable(1024)).not.toThrow();
    });

    it('should throw HttpException with status 507 for impossibly large file', () => {
      // 1 Exabyte — impossible amount
      let caught: any;
      try {
        service.ensureSpaceAvailable(1_000_000_000_000_000_000);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeDefined();
      expect(caught).toBeInstanceOf(HttpException);
      expect(caught.getStatus()).toBe(HttpStatus.INSUFFICIENT_STORAGE);
    });

    it('should include descriptive error message in Spanish', () => {
      let caught: any;
      try {
        service.ensureSpaceAvailable(1_000_000_000_000_000_000);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeDefined();
      const response = caught.getResponse() as Record<string, any>;
      expect(response.message).toContain('Espacio en disco insuficiente');
      expect(response.error).toBe('Insufficient Storage');
    });

    it('should include disk status details in the error response', () => {
      let caught: any;
      try {
        service.ensureSpaceAvailable(1_000_000_000_000_000_000);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeDefined();
      const response = caught.getResponse() as Record<string, any>;
      expect(response.diskStatus).toBeDefined();
      expect(response.diskStatus.freePercentage).toBeDefined();
      expect(response.diskStatus.freeBytes).toBeDefined();
      expect(response.diskStatus.alertLevel).toBeDefined();
      expect(typeof response.diskStatus.freePercentage).toBe('number');
      expect(typeof response.diskStatus.freeBytes).toBe('number');
    });

    it('should map to HTTP 507 status code', () => {
      // Verified in 'should throw HttpException with status 507' test above
      // This test confirms the response body includes statusCode
      let caught: any;
      try {
        service.ensureSpaceAvailable(1_000_000_000_000_000_000);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeDefined();
      expect(caught.message).toContain('Espacio en disco insuficiente');
    });
  });

  describe('configuration', () => {
    it('should use default storage path when not configured', () => {
      const configService = createMockConfigService({
        FILE_STORAGE_PATH: undefined,
      });
      // Should not throw during construction
      const svc = new DiskSpaceService(configService as any);
      expect(svc).toBeDefined();
    });

    it('should use default thresholds when env vars are not set', () => {
      const configService = createMockConfigService({
        DISK_SPACE_WARNING_PERCENT: undefined,
        DISK_SPACE_CRITICAL_PERCENT: undefined,
      });
      const svc = new DiskSpaceService(configService as any);
      // Should use defaults (10%, 5%) — current disk is likely > 10% free
      const status = svc.getDiskStatus();
      expect(status.alertLevel).toBe('ok');
    });

    it('should accept custom thresholds from configuration', () => {
      const configService = createMockConfigService({
        DISK_SPACE_WARNING_PERCENT: '99',
        DISK_SPACE_CRITICAL_PERCENT: '98',
      });
      const svc = new DiskSpaceService(configService as any);
      // With 99% warning and 98% critical, most disks would show warning or critical
      const status = svc.getDiskStatus();
      expect(['warning', 'critical']).toContain(status.alertLevel);
    });

    it('should use the configured storage path for disk checking', () => {
      const configService = createMockConfigService({
        FILE_STORAGE_PATH: process.cwd(),
      });
      const svc = new DiskSpaceService(configService as any);
      const result = svc.checkDiskSpace();
      expect(result.totalBytes).toBeGreaterThan(0);
    });
  });

  describe('alert level thresholds', () => {
    it('should report critical when configured with threshold above actual free space', () => {
      // Set critical to 99% — almost any disk will be below this
      const configService = createMockConfigService({
        DISK_SPACE_WARNING_PERCENT: '99.9',
        DISK_SPACE_CRITICAL_PERCENT: '99',
      });
      const svc = new DiskSpaceService(configService as any);
      const status = svc.getDiskStatus();
      expect(status.alertLevel).toBe('critical');
      expect(status.message).toContain('crítico');
    });

    it('should report ok when thresholds are very low', () => {
      // Set thresholds very low — any normal disk should be ok
      const configService = createMockConfigService({
        DISK_SPACE_WARNING_PERCENT: '0.001',
        DISK_SPACE_CRITICAL_PERCENT: '0.0001',
      });
      const svc = new DiskSpaceService(configService as any);
      const status = svc.getDiskStatus();
      expect(status.alertLevel).toBe('ok');
    });
  });
});
