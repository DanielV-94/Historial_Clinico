import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { NotFoundException } from '@nestjs/common';

describe('BackupController', () => {
  let controller: BackupController;
  let mockBackupService: any;

  beforeEach(() => {
    mockBackupService = {
      triggerManualBackup: vi.fn(),
      listBackups: vi.fn(),
      getBackupStatus: vi.fn(),
    };

    controller = new BackupController(mockBackupService as unknown as BackupService);
  });

  describe('POST /backups/trigger', () => {
    it('should trigger a backup and return result', async () => {
      mockBackupService.triggerManualBackup.mockResolvedValue({
        id: 'backup-id',
        status: 'success',
      });

      const result = await controller.triggerBackup();

      expect(result.message).toBe('Backup triggered successfully');
      expect(result.backupId).toBe('backup-id');
      expect(result.status).toBe('success');
    });
  });

  describe('GET /backups', () => {
    it('should list backups with default pagination', async () => {
      const mockResponse = {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      };
      mockBackupService.listBackups.mockResolvedValue(mockResponse);

      const result = await controller.listBackups(undefined, undefined);

      expect(mockBackupService.listBackups).toHaveBeenCalledWith(1, 20);
      expect(result).toEqual(mockResponse);
    });

    it('should parse page and limit from query params', async () => {
      mockBackupService.listBackups.mockResolvedValue({ data: [], total: 0, page: 2, limit: 10 });

      await controller.listBackups('2', '10');

      expect(mockBackupService.listBackups).toHaveBeenCalledWith(2, 10);
    });
  });

  describe('GET /backups/:id/status', () => {
    it('should return backup status when found', async () => {
      const mockRecord = {
        id: 'backup-id',
        status: 'success',
        sizeBytes: '1024',
        filePath: '/backups/test.tar.gz.enc',
      };
      mockBackupService.getBackupStatus.mockResolvedValue(mockRecord);

      const result = await controller.getBackupStatus('backup-id');

      expect(result).toEqual(mockRecord);
    });

    it('should throw NotFoundException when backup not found', async () => {
      mockBackupService.getBackupStatus.mockResolvedValue(null);

      await expect(controller.getBackupStatus('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
