import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/** Alert level for disk space status */
export type DiskAlertLevel = 'ok' | 'warning' | 'critical';

/** Disk space information */
export interface DiskSpaceInfo {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  freePercentage: number;
}

/** Disk status with alert level */
export interface DiskStatus {
  info: DiskSpaceInfo;
  alertLevel: DiskAlertLevel;
  message: string;
}

/**
 * DiskSpaceService monitors available disk space and prevents uploads
 * when space is insufficient.
 *
 * Uses Node.js `fs.statfs` (Node 18.15+) for cross-platform disk stats,
 * with fallback to platform-specific commands.
 *
 * Configuration via environment variables:
 * - DISK_SPACE_WARNING_PERCENT: Warning threshold (default 10%)
 * - DISK_SPACE_CRITICAL_PERCENT: Critical threshold (default 5%)
 * - FILE_STORAGE_PATH: Base path for storage (default /data/clinic-files)
 *
 * Requirements: 12.4, 3.7
 */
@Injectable()
export class DiskSpaceService {
  private readonly logger = new Logger(DiskSpaceService.name);
  private readonly storagePath: string;
  private readonly warningPercent: number;
  private readonly criticalPercent: number;

  constructor(private readonly configService: ConfigService) {
    this.storagePath =
      this.configService.get<string>('FILE_STORAGE_PATH') ||
      '/data/clinic-files';

    this.warningPercent =
      Number(this.configService.get<string>('DISK_SPACE_WARNING_PERCENT')) || 10;

    this.criticalPercent =
      Number(this.configService.get<string>('DISK_SPACE_CRITICAL_PERCENT')) || 5;
  }

  /**
   * Returns disk space information for the configured storage path.
   * Uses fs.statfsSync (Node 18.15+) as primary method, falls back
   * to platform-specific commands.
   */
  checkDiskSpace(): DiskSpaceInfo {
    try {
      return this.checkWithStatfs();
    } catch {
      this.logger.warn(
        'fs.statfsSync not available or failed, falling back to platform commands',
      );
      return this.checkWithPlatformCommand();
    }
  }

  /**
   * Checks if there is enough free space for a file of the given size.
   * Returns true if free space > requiredBytes + threshold buffer.
   *
   * The threshold buffer is the critical percentage of total space,
   * ensuring we never let disk usage drop below the critical level.
   */
  hasEnoughSpace(requiredBytes: number): boolean {
    const info = this.checkDiskSpace();
    const thresholdBuffer = (info.totalBytes * this.criticalPercent) / 100;
    return info.freeBytes > requiredBytes + thresholdBuffer;
  }

  /**
   * Returns a full disk status object including the alert level
   * based on configured thresholds.
   *
   * Alert levels:
   * - 'ok': Free space above warning threshold
   * - 'warning': Free space between critical and warning thresholds
   * - 'critical': Free space below critical threshold
   */
  getDiskStatus(): DiskStatus {
    const info = this.checkDiskSpace();
    let alertLevel: DiskAlertLevel;
    let message: string;

    if (info.freePercentage <= this.criticalPercent) {
      alertLevel = 'critical';
      message = `Espacio en disco crítico: ${info.freePercentage.toFixed(1)}% disponible. Las subidas de archivos están bloqueadas.`;
    } else if (info.freePercentage <= this.warningPercent) {
      alertLevel = 'warning';
      message = `Espacio en disco bajo: ${info.freePercentage.toFixed(1)}% disponible. Se recomienda liberar espacio.`;
    } else {
      alertLevel = 'ok';
      message = `Espacio en disco disponible: ${info.freePercentage.toFixed(1)}%`;
    }

    return { info, alertLevel, message };
  }

  /**
   * Ensures there is enough disk space for a file upload.
   * Throws HTTP 507 (Insufficient Storage) when space is insufficient.
   *
   * Should be called by FileService before writing files to disk.
   *
   * Requirements: 12.4, 3.7
   */
  ensureSpaceAvailable(requiredBytes: number): void {
    if (!this.hasEnoughSpace(requiredBytes)) {
      const status = this.getDiskStatus();
      throw new HttpException(
        {
          statusCode: HttpStatus.INSUFFICIENT_STORAGE,
          message: `Espacio en disco insuficiente para completar la subida. ${status.message}`,
          error: 'Insufficient Storage',
          diskStatus: {
            freePercentage: status.info.freePercentage,
            freeBytes: status.info.freeBytes,
            alertLevel: status.alertLevel,
          },
        },
        HttpStatus.INSUFFICIENT_STORAGE,
      );
    }
  }

  /**
   * Uses Node.js fs.statfsSync (Node 18.15+) to get disk stats.
   */
  private checkWithStatfs(): DiskSpaceInfo {
    const checkPath = this.getExistingPath();
    const stats = fsSync.statfsSync(checkPath);

    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bavail * stats.bsize;
    const usedBytes = totalBytes - freeBytes;
    const freePercentage = totalBytes > 0 ? (freeBytes / totalBytes) * 100 : 0;

    return { totalBytes, freeBytes, usedBytes, freePercentage };
  }

  /**
   * Fallback: Uses platform-specific commands to get disk stats.
   */
  private checkWithPlatformCommand(): DiskSpaceInfo {
    const checkPath = this.getExistingPath();

    if (process.platform === 'win32') {
      return this.checkWindows(checkPath);
    }

    return this.checkUnix(checkPath);
  }

  private checkUnix(checkPath: string): DiskSpaceInfo {
    try {
      const output = execSync(`df -k "${checkPath}"`, {
        encoding: 'utf8',
        timeout: 5000,
      });

      const lines = output.trim().split('\n');
      if (lines.length < 2) {
        throw new Error('Unexpected df output format');
      }

      const parts = lines[1].split(/\s+/);
      const totalKB = parseInt(parts[1], 10);
      const usedKB = parseInt(parts[2], 10);
      const availableKB = parseInt(parts[3], 10);

      const totalBytes = totalKB * 1024;
      const freeBytes = availableKB * 1024;
      const usedBytes = usedKB * 1024;
      const freePercentage = totalBytes > 0 ? (freeBytes / totalBytes) * 100 : 0;

      return { totalBytes, freeBytes, usedBytes, freePercentage };
    } catch (err) {
      this.logger.error(`Failed to execute df command: ${(err as Error).message}`);
      return this.getDefaultDiskInfo();
    }
  }

  private checkWindows(checkPath: string): DiskSpaceInfo {
    try {
      const driveLetter = path.parse(checkPath).root.charAt(0).toUpperCase();
      const output = execSync(
        `wmic logicaldisk where "DeviceID='${driveLetter}:'" get Size,FreeSpace /format:csv`,
        { encoding: 'utf8', timeout: 5000 },
      );

      const lines = output.trim().split('\n').filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        throw new Error('Unexpected wmic output format');
      }

      const lastLine = lines[lines.length - 1].trim();
      const parts = lastLine.split(',');

      const freeBytes = parseInt(parts[1], 10);
      const totalBytes = parseInt(parts[2], 10);
      const usedBytes = totalBytes - freeBytes;
      const freePercentage = totalBytes > 0 ? (freeBytes / totalBytes) * 100 : 0;

      return { totalBytes, freeBytes, usedBytes, freePercentage };
    } catch (err) {
      this.logger.error(`Failed to execute wmic command: ${(err as Error).message}`);
      return this.getDefaultDiskInfo();
    }
  }

  /**
   * Returns the first existing path in the hierarchy starting from storagePath.
   */
  private getExistingPath(): string {
    let checkPath = this.storagePath;

    while (!fsSync.existsSync(checkPath)) {
      const parent = path.dirname(checkPath);
      if (parent === checkPath) {
        break;
      }
      checkPath = parent;
    }

    return checkPath;
  }

  /**
   * Returns a safe default disk info when platform commands fail.
   */
  private getDefaultDiskInfo(): DiskSpaceInfo {
    this.logger.warn(
      'Could not determine disk space. Returning default (assumed available).',
    );
    return {
      totalBytes: 1_000_000_000_000,
      freeBytes: 500_000_000_000,
      usedBytes: 500_000_000_000,
      freePercentage: 50,
    };
  }
}
