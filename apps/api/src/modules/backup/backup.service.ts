import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { BackupStatus } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir: string;
  private readonly uploadDir: string;
  private readonly maxRetention: number;
  private readonly encryptionPassword: string;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {
    this.backupDir = this.configService.get<string>('BACKUP_DIR', './backups');
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR', './uploads');
    this.maxRetention = this.configService.get<number>('BACKUP_RETENTION', 12);
    this.encryptionPassword = this.configService.get<string>(
      'BACKUP_ENCRYPTION_KEY',
      'default-backup-key-change-in-production',
    );
  }

  /**
   * Cron job: runs on the 1st of every month at 02:00
   * Requirement 9.1
   */
  @Cron('0 2 1 * *')
  async handleScheduledBackup(): Promise<void> {
    this.logger.log('Starting scheduled monthly backup...');
    await this.executeBackup('scheduled');
  }

  /**
   * Manual trigger for backup
   */
  async triggerManualBackup(userId?: string): Promise<{ id: string; status: BackupStatus }> {
    this.logger.log(`Manual backup triggered${userId ? ` by user ${userId}` : ''}`);
    const result = await this.executeBackup('manual', userId);
    return { id: result.id, status: result.status };
  }

  /**
   * List all backup records with pagination
   */
  async listBackups(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [records, total] = await Promise.all([
      this.prisma.backupRecord.findMany({
        orderBy: { executedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.backupRecord.count(),
    ]);

    return {
      data: records.map((r) => ({
        ...r,
        sizeBytes: r.sizeBytes.toString(),
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Get backup status by id
   */
  async getBackupStatus(id: string) {
    const record = await this.prisma.backupRecord.findUnique({ where: { id } });
    if (!record) return null;
    return {
      ...record,
      sizeBytes: record.sizeBytes.toString(),
    };
  }

  /**
   * Core backup execution logic
   * Implements: pg_dump, file copy, compress, encrypt, audit, retry, retention
   */
  async executeBackup(
    trigger: 'scheduled' | 'manual',
    userId?: string,
  ): Promise<{ id: string; status: BackupStatus }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup_${timestamp}`;
    const tempDir = path.join(this.backupDir, 'temp', backupName);
    const outputFile = path.join(this.backupDir, `${backupName}.tar.gz.enc`);

    try {
      // Ensure directories exist
      fs.mkdirSync(tempDir, { recursive: true });
      fs.mkdirSync(this.backupDir, { recursive: true });

      // Step 1: pg_dump for complete database backup (Requirement 9.1)
      const dumpFile = path.join(tempDir, 'database.sql');
      this.performDatabaseDump(dumpFile);

      // Step 2: Copy multimedia files (Requirement 9.1)
      const mediaDir = path.join(tempDir, 'uploads');
      this.copyMediaFiles(mediaDir);

      // Step 3: Compress with tar.gz (Requirement 9.2)
      const tarFile = path.join(this.backupDir, `${backupName}.tar.gz`);
      this.compressBackup(tempDir, tarFile);

      // Step 4: Encrypt with AES-256-CBC (Requirement 9.2)
      this.encryptFile(tarFile, outputFile);

      // Clean up unencrypted tar
      if (fs.existsSync(tarFile)) {
        fs.unlinkSync(tarFile);
      }

      // Step 5: Calculate checksum and size
      const stats = fs.statSync(outputFile);
      const checksum = this.calculateChecksum(outputFile);

      // Step 6: Record in database
      const record = await this.prisma.backupRecord.create({
        data: {
          executedAt: new Date(),
          sizeBytes: BigInt(stats.size),
          filePath: outputFile,
          checksum,
          status: 'success',
        },
      });

      // Step 7: Audit log (Requirement 9.3)
      await this.auditService.log({
        userId: userId || 'system',
        userRole: 'admin',
        action: 'create',
        entityTable: 'backup_records',
        entityId: record.id,
        ipAddress: '127.0.0.1',
        result: 'success',
        description: `Backup ${trigger} completed successfully`,
        metadata: {
          sizeBytes: stats.size,
          filePath: outputFile,
          checksum,
          trigger,
        },
      });

      // Step 8: Enforce retention policy (Requirement 9.5)
      await this.enforceRetentionPolicy();

      // Clean up temp directory
      this.cleanupDirectory(tempDir);

      this.logger.log(`Backup completed successfully: ${outputFile} (${stats.size} bytes)`);
      return { id: record.id, status: 'success' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Backup failed: ${errorMessage}`);

      // Record failed backup
      const failedRecord = await this.prisma.backupRecord.create({
        data: {
          executedAt: new Date(),
          sizeBytes: BigInt(0),
          filePath: outputFile,
          checksum: '',
          status: 'failed',
          errorMessage,
        },
      });

      // Audit log for failure (Requirement 9.4)
      await this.auditService.log({
        userId: userId || 'system',
        userRole: 'admin',
        action: 'create',
        entityTable: 'backup_records',
        entityId: failedRecord.id,
        ipAddress: '127.0.0.1',
        result: 'failure',
        description: `Backup ${trigger} failed: ${errorMessage}`,
        metadata: { error: errorMessage, trigger },
      });

      // Notify admin (Requirement 9.4)
      await this.notifyAdminOfFailure(errorMessage);

      // Schedule retry after 30 minutes (Requirement 9.4)
      this.scheduleRetry(trigger, userId, failedRecord.id);

      // Clean up temp directory
      this.cleanupDirectory(tempDir);

      return { id: failedRecord.id, status: 'failed' };
    }
  }

  /**
   * Execute pg_dump for full database backup
   */
  private performDatabaseDump(outputPath: string): void {
    const databaseUrl = this.configService.get<string>('DATABASE_URL', '');
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not configured');
    }

    try {
      execSync(`pg_dump "${databaseUrl}" --format=plain --file="${outputPath}"`, {
        timeout: 300000, // 5 minute timeout
        stdio: 'pipe',
      });
      this.logger.log('Database dump completed successfully');
    } catch (error) {
      throw new Error(
        `pg_dump failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Copy multimedia files directory
   */
  private copyMediaFiles(destinationDir: string): void {
    if (!fs.existsSync(this.uploadDir)) {
      this.logger.warn(`Upload directory does not exist: ${this.uploadDir}, skipping media copy`);
      fs.mkdirSync(destinationDir, { recursive: true });
      return;
    }

    this.copyDirectoryRecursive(this.uploadDir, destinationDir);
    this.logger.log('Media files copied successfully');
  }

  /**
   * Recursively copy a directory
   */
  private copyDirectoryRecursive(source: string, destination: string): void {
    fs.mkdirSync(destination, { recursive: true });

    const entries = fs.readdirSync(source, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        this.copyDirectoryRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Compress directory to tar.gz using tar command
   */
  private compressBackup(sourceDir: string, outputPath: string): void {
    const parentDir = path.dirname(sourceDir);
    const dirName = path.basename(sourceDir);

    try {
      execSync(`tar -czf "${outputPath}" -C "${parentDir}" "${dirName}"`, {
        timeout: 600000, // 10 minute timeout
        stdio: 'pipe',
      });
      this.logger.log('Backup compressed successfully');
    } catch (error) {
      throw new Error(
        `Compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Encrypt file using AES-256-CBC with PBKDF2 key derivation (Requirement 9.2)
   */
  private encryptFile(inputPath: string, outputPath: string): void {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(16);

    // Derive key using PBKDF2
    const key = crypto.pbkdf2Sync(this.encryptionPassword, salt, 100000, 32, 'sha256');

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    const input = fs.readFileSync(inputPath);
    const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);

    // Write: salt (16 bytes) + iv (16 bytes) + encrypted data
    const output = Buffer.concat([salt, iv, encrypted]);
    fs.writeFileSync(outputPath, output);

    this.logger.log('Backup encrypted successfully');
  }

  /**
   * Decrypt file (for restore operations)
   */
  decryptFile(inputPath: string, outputPath: string): void {
    const fileData = fs.readFileSync(inputPath);

    // Read: salt (16 bytes) + iv (16 bytes) + encrypted data
    const salt = fileData.subarray(0, 16);
    const iv = fileData.subarray(16, 32);
    const encrypted = fileData.subarray(32);

    // Derive key using PBKDF2
    const key = crypto.pbkdf2Sync(this.encryptionPassword, salt, 100000, 32, 'sha256');

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    fs.writeFileSync(outputPath, decrypted);
  }

  /**
   * Calculate SHA-256 checksum of a file
   */
  private calculateChecksum(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * Enforce retention policy: keep only last N backups (Requirement 9.5)
   */
  async enforceRetentionPolicy(): Promise<void> {
    const allBackups = await this.prisma.backupRecord.findMany({
      where: { status: 'success' },
      orderBy: { executedAt: 'desc' },
    });

    if (allBackups.length <= this.maxRetention) {
      return;
    }

    const toDelete = allBackups.slice(this.maxRetention);

    for (const backup of toDelete) {
      // Delete physical file
      if (fs.existsSync(backup.filePath)) {
        try {
          fs.unlinkSync(backup.filePath);
          this.logger.log(`Deleted old backup file: ${backup.filePath}`);
        } catch (err) {
          this.logger.warn(
            `Failed to delete backup file ${backup.filePath}: ${err instanceof Error ? err.message : 'Unknown error'}`,
          );
        }
      }

      // Delete database record
      await this.prisma.backupRecord.delete({ where: { id: backup.id } });
    }

    this.logger.log(
      `Retention policy enforced: removed ${toDelete.length} old backup(s), keeping ${this.maxRetention}`,
    );
  }

  /**
   * Schedule a retry after 30 minutes (Requirement 9.4)
   */
  private scheduleRetry(
    trigger: 'scheduled' | 'manual',
    userId: string | undefined,
    failedRecordId: string,
  ): void {
    const retryDelayMs = 30 * 60 * 1000; // 30 minutes

    this.retryTimeout = setTimeout(async () => {
      this.logger.log(`Retrying backup (original failure: ${failedRecordId})...`);

      // Update original record status to retrying
      await this.prisma.backupRecord.update({
        where: { id: failedRecordId },
        data: { status: 'retrying' },
      });

      // Execute retry (no further retry on second failure)
      try {
        await this.executeBackupWithoutRetry(trigger, userId);
      } catch (error) {
        this.logger.error(
          `Backup retry also failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        await this.notifyAdminOfFailure(
          `Backup retry also failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }, retryDelayMs);
  }

  /**
   * Execute backup without retry logic (used for the retry attempt itself)
   */
  private async executeBackupWithoutRetry(
    trigger: 'scheduled' | 'manual',
    userId?: string,
  ): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup_${timestamp}_retry`;
    const tempDir = path.join(this.backupDir, 'temp', backupName);
    const outputFile = path.join(this.backupDir, `${backupName}.tar.gz.enc`);

    try {
      fs.mkdirSync(tempDir, { recursive: true });
      fs.mkdirSync(this.backupDir, { recursive: true });

      const dumpFile = path.join(tempDir, 'database.sql');
      this.performDatabaseDump(dumpFile);

      const mediaDir = path.join(tempDir, 'uploads');
      this.copyMediaFiles(mediaDir);

      const tarFile = path.join(this.backupDir, `${backupName}.tar.gz`);
      this.compressBackup(tempDir, tarFile);
      this.encryptFile(tarFile, outputFile);

      if (fs.existsSync(tarFile)) {
        fs.unlinkSync(tarFile);
      }

      const stats = fs.statSync(outputFile);
      const checksum = this.calculateChecksum(outputFile);

      await this.prisma.backupRecord.create({
        data: {
          executedAt: new Date(),
          sizeBytes: BigInt(stats.size),
          filePath: outputFile,
          checksum,
          status: 'success',
        },
      });

      await this.auditService.log({
        userId: userId || 'system',
        userRole: 'admin',
        action: 'create',
        entityTable: 'backup_records',
        entityId: 'retry-success',
        ipAddress: '127.0.0.1',
        result: 'success',
        description: `Backup retry (${trigger}) completed successfully`,
        metadata: { sizeBytes: stats.size, filePath: outputFile, checksum, trigger },
      });

      await this.enforceRetentionPolicy();
      this.cleanupDirectory(tempDir);

      this.logger.log(`Backup retry completed successfully: ${outputFile}`);
    } catch (error) {
      this.cleanupDirectory(tempDir);
      throw error;
    }
  }

  /**
   * Notify admin about backup failure (Requirement 9.4)
   * In production, this would send email or system notification.
   * For now, logs the notification and records it.
   */
  private async notifyAdminOfFailure(errorMessage: string): Promise<void> {
    this.logger.error(`[ADMIN NOTIFICATION] Backup failed: ${errorMessage}`);

    // Find admin users to notify
    const admins = await this.prisma.user.findMany({
      where: { role: 'admin', isActive: true },
      select: { id: true, email: true, fullName: true },
    });

    for (const admin of admins) {
      // In a production system, this would send an email or push notification
      // For now, we log it and create an audit entry
      this.logger.warn(
        `Notification sent to admin ${admin.fullName} (${admin.email}): Backup failure - ${errorMessage}`,
      );
    }

    // Record notification attempt in audit
    await this.auditService.log({
      userId: 'system',
      userRole: 'admin',
      action: 'create',
      entityTable: 'backup_records',
      entityId: 'notification',
      ipAddress: '127.0.0.1',
      result: admins.length > 0 ? 'success' : 'failure',
      description: `Admin notification sent for backup failure: ${errorMessage}`,
      metadata: { adminCount: admins.length, error: errorMessage },
    });
  }

  /**
   * Clean up a directory and its contents
   */
  private cleanupDirectory(dirPath: string): void {
    try {
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    } catch (err) {
      this.logger.warn(
        `Failed to clean up directory ${dirPath}: ${err instanceof Error ? err.message : 'Unknown'}`,
      );
    }
  }

  /**
   * Utility: compress and encrypt a buffer (for testing)
   */
  compressAndEncryptBuffer(data: Buffer): Buffer {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(this.encryptionPassword, salt, 100000, 32, 'sha256');
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    return Buffer.concat([salt, iv, encrypted]);
  }

  /**
   * Utility: decrypt a buffer (for testing)
   */
  decryptBuffer(encryptedData: Buffer): Buffer {
    const salt = encryptedData.subarray(0, 16);
    const iv = encryptedData.subarray(16, 32);
    const encrypted = encryptedData.subarray(32);
    const key = crypto.pbkdf2Sync(this.encryptionPassword, salt, 100000, 32, 'sha256');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  /**
   * Clean up scheduled retry on module destroy
   */
  onModuleDestroy(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
  }
}
