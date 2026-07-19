import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackupService } from './backup.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

describe('BackupService', () => {
  let service: BackupService;
  let mockPrisma: any;
  let mockAuditService: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockPrisma = {
      backupRecord: {
        create: vi.fn().mockResolvedValue({ id: 'test-id', status: 'success' }),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        delete: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    mockAuditService = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    mockConfigService = {
      get: vi.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          BACKUP_DIR: './test-backups',
          UPLOAD_DIR: './test-uploads',
          BACKUP_RETENTION: 12,
          BACKUP_ENCRYPTION_KEY: 'test-key-for-encryption',
          DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        };
        return config[key] ?? defaultValue;
      }),
    };

    service = new BackupService(
      mockPrisma,
      mockAuditService,
      mockConfigService as unknown as ConfigService,
    );
  });

  describe('compressAndEncryptBuffer / decryptBuffer', () => {
    it('should encrypt and decrypt data correctly (round-trip)', () => {
      const originalData = Buffer.from('Hello, this is test backup data!');
      const encrypted = service.compressAndEncryptBuffer(originalData);
      const decrypted = service.decryptBuffer(encrypted);

      expect(decrypted).toEqual(originalData);
    });

    it('should produce different ciphertext for same input (random salt/iv)', () => {
      const data = Buffer.from('Same input data');
      const encrypted1 = service.compressAndEncryptBuffer(data);
      const encrypted2 = service.compressAndEncryptBuffer(data);

      // Different salt+iv means different output
      expect(encrypted1).not.toEqual(encrypted2);

      // But both decrypt to same plaintext
      expect(service.decryptBuffer(encrypted1)).toEqual(data);
      expect(service.decryptBuffer(encrypted2)).toEqual(data);
    });

    it('should handle empty data', () => {
      const emptyData = Buffer.alloc(0);
      const encrypted = service.compressAndEncryptBuffer(emptyData);
      const decrypted = service.decryptBuffer(encrypted);

      expect(decrypted).toEqual(emptyData);
    });

    it('should handle large data', () => {
      const largeData = crypto.randomBytes(1024 * 100); // 100KB
      const encrypted = service.compressAndEncryptBuffer(largeData);
      const decrypted = service.decryptBuffer(encrypted);

      expect(decrypted).toEqual(largeData);
    });
  });

  describe('listBackups', () => {
    it('should return paginated backup records', async () => {
      const mockRecords = [
        {
          id: 'id-1',
          executedAt: new Date(),
          sizeBytes: BigInt(1024),
          filePath: '/backups/test.tar.gz.enc',
          checksum: 'abc123',
          status: 'success',
          errorMessage: null,
          createdAt: new Date(),
        },
      ];
      mockPrisma.backupRecord.findMany.mockResolvedValue(mockRecords);
      mockPrisma.backupRecord.count.mockResolvedValue(1);

      const result = await service.listBackups(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].sizeBytes).toBe('1024');
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should calculate skip correctly for pagination', async () => {
      mockPrisma.backupRecord.findMany.mockResolvedValue([]);
      mockPrisma.backupRecord.count.mockResolvedValue(0);

      await service.listBackups(3, 10);

      expect(mockPrisma.backupRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  describe('getBackupStatus', () => {
    it('should return null for non-existent backup', async () => {
      mockPrisma.backupRecord.findUnique.mockResolvedValue(null);
      const result = await service.getBackupStatus('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return backup record with string sizeBytes', async () => {
      const mockRecord = {
        id: 'test-id',
        executedAt: new Date(),
        sizeBytes: BigInt(2048),
        filePath: '/backups/test.tar.gz.enc',
        checksum: 'abc123',
        status: 'success',
        errorMessage: null,
        createdAt: new Date(),
      };
      mockPrisma.backupRecord.findUnique.mockResolvedValue(mockRecord);

      const result = await service.getBackupStatus('test-id');
      expect(result).not.toBeNull();
      expect(result!.sizeBytes).toBe('2048');
    });
  });

  describe('enforceRetentionPolicy', () => {
    it('should not delete anything when under retention limit', async () => {
      const records = Array.from({ length: 10 }, (_, i) => ({
        id: `id-${i}`,
        filePath: `/backups/backup-${i}.tar.gz.enc`,
        executedAt: new Date(Date.now() - i * 86400000),
        status: 'success',
      }));
      mockPrisma.backupRecord.findMany.mockResolvedValue(records);

      await service.enforceRetentionPolicy();

      expect(mockPrisma.backupRecord.delete).not.toHaveBeenCalled();
    });

    it('should delete oldest backups when exceeding retention limit', async () => {
      const records = Array.from({ length: 15 }, (_, i) => ({
        id: `id-${i}`,
        filePath: `/backups/backup-${i}.tar.gz.enc`,
        executedAt: new Date(Date.now() - i * 86400000),
        status: 'success',
      }));
      mockPrisma.backupRecord.findMany.mockResolvedValue(records);

      await service.enforceRetentionPolicy();

      // Should delete 3 oldest (15 - 12 = 3)
      expect(mockPrisma.backupRecord.delete).toHaveBeenCalledTimes(3);
      expect(mockPrisma.backupRecord.delete).toHaveBeenCalledWith({ where: { id: 'id-12' } });
      expect(mockPrisma.backupRecord.delete).toHaveBeenCalledWith({ where: { id: 'id-13' } });
      expect(mockPrisma.backupRecord.delete).toHaveBeenCalledWith({ where: { id: 'id-14' } });
    });
  });
});
