import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { BackupService } from './backup.service';

/**
 * **Validates: Requirements 9.2, 9.5**
 *
 * Property 13: Round-trip de respaldo
 * Para cualquier conjunto de datos de entrada (dump de BD + archivos),
 * el pipeline de respaldo (tar.gz + AES-256 encrypt) seguido de
 * (decrypt + decompress) SHALL producir datos idénticos a los originales,
 * verificable mediante comparación de checksum.
 *
 * Property 14: Retención máxima de respaldos
 * Para cualquier lista de respaldos almacenados, después de ejecutar el
 * proceso de limpieza, la cantidad de respaldos retenidos SHALL ser ≤ la
 * cantidad máxima configurada (12 por defecto), y los eliminados SHALL ser
 * siempre los más antiguos.
 */

const NUM_RUNS = 100;

// ============================================================
// MOCK SETUP
// ============================================================

function createMockPrismaService() {
  return {
    backupRecord: {
      findMany: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
}

function createMockAuditService() {
  return {
    log: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockConfigService(overrides: Record<string, any> = {}) {
  const defaults: Record<string, any> = {
    BACKUP_DIR: './backups',
    UPLOAD_DIR: './uploads',
    BACKUP_RETENTION: 12,
    BACKUP_ENCRYPTION_KEY: 'test-encryption-key-for-property-tests',
  };

  const config = { ...defaults, ...overrides };

  return {
    get: vi.fn((key: string, defaultValue?: any) => {
      return config[key] !== undefined ? config[key] : defaultValue;
    }),
  };
}

function createBackupService(
  prisma?: any,
  audit?: any,
  configOverrides?: Record<string, any>,
): BackupService {
  const mockPrisma = prisma || createMockPrismaService();
  const mockAudit = audit || createMockAuditService();
  const mockConfig = createMockConfigService(configOverrides);

  return new BackupService(mockPrisma as any, mockAudit as any, mockConfig as any);
}

// ============================================================
// ARBITRARIES
// ============================================================

/** Generate arbitrary binary data (simulating backup payload) */
const binaryDataArb = fc.uint8Array({ minLength: 1, maxLength: 4096 }).map((arr) => Buffer.from(arr));

/** Generate small binary data for faster encryption rounds */
const smallBinaryDataArb = fc.uint8Array({ minLength: 1, maxLength: 512 }).map((arr) => Buffer.from(arr));

/** Generate a valid UUID v4 */
const uuidArb = fc
  .tuple(
    fc.hexaString({ minLength: 8, maxLength: 8 }),
    fc.hexaString({ minLength: 4, maxLength: 4 }),
    fc.hexaString({ minLength: 4, maxLength: 4 }),
    fc.hexaString({ minLength: 4, maxLength: 4 }),
    fc.hexaString({ minLength: 12, maxLength: 12 }),
  )
  .map(([a, b, c, d, e]) => `${a}-${b}-4${c.slice(1)}-${d}-${e}`);

/** Generate a random date within a reasonable range */
const dateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') });

/** Generate a backup record with id, executedAt, filePath, and status */
const backupRecordArb = fc
  .tuple(uuidArb, dateArb, fc.string({ minLength: 5, maxLength: 100 }))
  .map(([id, executedAt, filePath]) => ({
    id,
    executedAt,
    filePath: `/backups/${filePath}.tar.gz.enc`,
    status: 'success' as const,
    sizeBytes: BigInt(1024),
    checksum: 'abc123',
  }));

/**
 * Generate a list of backup records with MORE than maxRetention (to trigger cleanup).
 * Records are generated with unique dates to ensure deterministic ordering.
 */
const backupListExceedingRetentionArb = (maxRetention: number) =>
  fc
    .array(
      fc.tuple(uuidArb, fc.string({ minLength: 5, maxLength: 50 })),
      { minLength: maxRetention + 1, maxLength: maxRetention + 20 },
    )
    .map((records) => {
      // Assign incrementing dates so ordering is deterministic
      const baseDate = new Date('2022-01-01');
      return records.map(([id, filePath], index) => ({
        id,
        executedAt: new Date(baseDate.getTime() + index * 30 * 24 * 60 * 60 * 1000), // ~monthly
        filePath: `/backups/${filePath}_${index}.tar.gz.enc`,
        status: 'success' as const,
        sizeBytes: BigInt(1024 * (index + 1)),
        checksum: `checksum_${index}`,
      }));
    });

/**
 * Generate a list of backup records with AT MOST maxRetention (no cleanup needed).
 */
const backupListWithinRetentionArb = (maxRetention: number) =>
  fc
    .array(
      fc.tuple(uuidArb, fc.string({ minLength: 5, maxLength: 50 })),
      { minLength: 0, maxLength: maxRetention },
    )
    .map((records) => {
      const baseDate = new Date('2022-01-01');
      return records.map(([id, filePath], index) => ({
        id,
        executedAt: new Date(baseDate.getTime() + index * 30 * 24 * 60 * 60 * 1000),
        filePath: `/backups/${filePath}_${index}.tar.gz.enc`,
        status: 'success' as const,
        sizeBytes: BigInt(1024 * (index + 1)),
        checksum: `checksum_${index}`,
      }));
    });

/** Generate a valid maxRetention number (between 1 and 30) */
const maxRetentionArb = fc.integer({ min: 1, max: 30 });

// ============================================================
// PROPERTY TESTS — Property 13: Round-trip de respaldo
// ============================================================

describe('BackupService - Property 13: Round-trip de respaldo', () => {
  let service: BackupService;

  beforeEach(() => {
    service = createBackupService();
  });

  it('should produce identical data after compress+encrypt → decrypt (any binary data)', () => {
    fc.assert(
      fc.property(smallBinaryDataArb, (originalData) => {
        // Encrypt
        const encrypted = service.compressAndEncryptBuffer(originalData);

        // Decrypt
        const decrypted = service.decryptBuffer(encrypted);

        // Round-trip must produce identical data
        expect(Buffer.compare(decrypted, originalData)).toBe(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should produce encrypted output different from original input', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 33, maxLength: 512 }).map((arr) => Buffer.from(arr)),
        (originalData) => {
          const encrypted = service.compressAndEncryptBuffer(originalData);

          // Encrypted output should NOT equal the original data
          // (salt + iv + ciphertext structure means it's always different)
          expect(Buffer.compare(encrypted, originalData)).not.toBe(0);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('should produce encrypted output with at least 32 bytes overhead (salt + iv)', () => {
    fc.assert(
      fc.property(smallBinaryDataArb, (originalData) => {
        const encrypted = service.compressAndEncryptBuffer(originalData);

        // salt (16) + iv (16) = 32 bytes minimum overhead
        expect(encrypted.length).toBeGreaterThanOrEqual(originalData.length + 32);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should produce different ciphertext for same input on each call (random salt+iv)', () => {
    fc.assert(
      fc.property(smallBinaryDataArb, (originalData) => {
        const encrypted1 = service.compressAndEncryptBuffer(originalData);
        const encrypted2 = service.compressAndEncryptBuffer(originalData);

        // Same plaintext should produce different ciphertext due to random salt+iv
        // (extremely unlikely to be the same with 32 bytes of randomness)
        expect(Buffer.compare(encrypted1, encrypted2)).not.toBe(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should maintain data integrity regardless of encryption password', () => {
    fc.assert(
      fc.property(
        smallBinaryDataArb,
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
        (originalData, password) => {
          // Create a service with a custom password
          const customService = createBackupService(undefined, undefined, {
            BACKUP_ENCRYPTION_KEY: password,
          });

          const encrypted = customService.compressAndEncryptBuffer(originalData);
          const decrypted = customService.decryptBuffer(encrypted);

          // Round-trip must still produce identical data
          expect(Buffer.compare(decrypted, originalData)).toBe(0);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

// ============================================================
// PROPERTY TESTS — Property 14: Retención máxima de respaldos
// ============================================================

describe('BackupService - Property 14: Retención máxima de respaldos', () => {
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let service: BackupService;

  beforeEach(() => {
    mockPrisma = createMockPrismaService();
    // Mock fs.existsSync and fs.unlinkSync to avoid filesystem operations
    vi.spyOn(require('fs'), 'existsSync').mockReturnValue(false);
  });

  it('should never retain more than maxRetention backups after cleanup', async () => {
    await fc.assert(
      fc.asyncProperty(
        maxRetentionArb,
        fc.integer({ min: 1, max: 20 }),
        async (maxRetention, extraCount) => {
          const totalCount = maxRetention + extraCount;
          const mockPrismaLocal = createMockPrismaService();

          // Generate records sorted by date desc (as the service queries them)
          const baseDate = new Date('2022-01-01');
          const allRecords = Array.from({ length: totalCount }, (_, i) => ({
            id: `id-${i}`,
            executedAt: new Date(baseDate.getTime() + (totalCount - 1 - i) * 30 * 24 * 60 * 60 * 1000),
            filePath: `/backups/backup_${i}.tar.gz.enc`,
            status: 'success' as const,
            sizeBytes: BigInt(1024),
            checksum: `checksum_${i}`,
          }));

          // Records returned sorted by executedAt desc (most recent first)
          const sortedRecords = [...allRecords].sort(
            (a, b) => b.executedAt.getTime() - a.executedAt.getTime(),
          );

          mockPrismaLocal.backupRecord.findMany.mockResolvedValue(sortedRecords);

          const localService = createBackupService(mockPrismaLocal, undefined, {
            BACKUP_RETENTION: maxRetention,
          });

          await localService.enforceRetentionPolicy();

          // Count how many were deleted
          const deleteCallCount = mockPrismaLocal.backupRecord.delete.mock.calls.length;

          // After deletion, retained count should be exactly maxRetention
          const retainedCount = totalCount - deleteCallCount;
          expect(retainedCount).toBeLessThanOrEqual(maxRetention);
          expect(retainedCount).toBe(maxRetention);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('should delete the oldest backups (those with earliest executedAt)', async () => {
    await fc.assert(
      fc.asyncProperty(
        maxRetentionArb,
        fc.integer({ min: 1, max: 15 }),
        async (maxRetention, extraCount) => {
          const totalCount = maxRetention + extraCount;
          const mockPrismaLocal = createMockPrismaService();

          // Generate records with unique dates
          const baseDate = new Date('2022-01-01');
          const allRecords = Array.from({ length: totalCount }, (_, i) => ({
            id: `id-${i}`,
            executedAt: new Date(baseDate.getTime() + i * 30 * 24 * 60 * 60 * 1000),
            filePath: `/backups/backup_${i}.tar.gz.enc`,
            status: 'success' as const,
            sizeBytes: BigInt(1024),
            checksum: `checksum_${i}`,
          }));

          // Sort desc by executedAt (most recent first) — as the service queries them
          const sortedRecords = [...allRecords].sort(
            (a, b) => b.executedAt.getTime() - a.executedAt.getTime(),
          );

          mockPrismaLocal.backupRecord.findMany.mockResolvedValue(sortedRecords);

          const localService = createBackupService(mockPrismaLocal, undefined, {
            BACKUP_RETENTION: maxRetention,
          });

          await localService.enforceRetentionPolicy();

          // Verify deleted records are the oldest ones
          const deletedIds = mockPrismaLocal.backupRecord.delete.mock.calls.map(
            (call: any) => call[0].where.id,
          );

          // The expected records to delete are those beyond maxRetention (the oldest)
          const expectedToDelete = sortedRecords.slice(maxRetention);
          const expectedDeletedIds = expectedToDelete.map((r) => r.id);

          expect(deletedIds.sort()).toEqual(expectedDeletedIds.sort());

          // Verify that all deleted records are older than all retained records
          const retainedRecords = sortedRecords.slice(0, maxRetention);
          const oldestRetained = retainedRecords[retainedRecords.length - 1].executedAt;

          for (const deletedRecord of expectedToDelete) {
            expect(deletedRecord.executedAt.getTime()).toBeLessThanOrEqual(
              oldestRetained.getTime(),
            );
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('should not delete any backups when count is within retention limit', async () => {
    await fc.assert(
      fc.asyncProperty(maxRetentionArb, async (maxRetention) => {
        const mockPrismaLocal = createMockPrismaService();

        // Generate records WITHIN the retention limit
        const count = Math.max(0, maxRetention - 1); // always under the limit
        const baseDate = new Date('2022-01-01');
        const allRecords = Array.from({ length: count }, (_, i) => ({
          id: `id-${i}`,
          executedAt: new Date(baseDate.getTime() + i * 30 * 24 * 60 * 60 * 1000),
          filePath: `/backups/backup_${i}.tar.gz.enc`,
          status: 'success' as const,
          sizeBytes: BigInt(1024),
          checksum: `checksum_${i}`,
        }));

        const sortedRecords = [...allRecords].sort(
          (a, b) => b.executedAt.getTime() - a.executedAt.getTime(),
        );

        mockPrismaLocal.backupRecord.findMany.mockResolvedValue(sortedRecords);

        const localService = createBackupService(mockPrismaLocal, undefined, {
          BACKUP_RETENTION: maxRetention,
        });

        await localService.enforceRetentionPolicy();

        // No deletions should occur
        expect(mockPrismaLocal.backupRecord.delete).not.toHaveBeenCalled();
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should not delete any backups when count equals the retention limit', async () => {
    await fc.assert(
      fc.asyncProperty(maxRetentionArb, async (maxRetention) => {
        const mockPrismaLocal = createMockPrismaService();

        // Generate records EXACTLY at the retention limit
        const baseDate = new Date('2022-01-01');
        const allRecords = Array.from({ length: maxRetention }, (_, i) => ({
          id: `id-${i}`,
          executedAt: new Date(baseDate.getTime() + i * 30 * 24 * 60 * 60 * 1000),
          filePath: `/backups/backup_${i}.tar.gz.enc`,
          status: 'success' as const,
          sizeBytes: BigInt(1024),
          checksum: `checksum_${i}`,
        }));

        const sortedRecords = [...allRecords].sort(
          (a, b) => b.executedAt.getTime() - a.executedAt.getTime(),
        );

        mockPrismaLocal.backupRecord.findMany.mockResolvedValue(sortedRecords);

        const localService = createBackupService(mockPrismaLocal, undefined, {
          BACKUP_RETENTION: maxRetention,
        });

        await localService.enforceRetentionPolicy();

        // No deletions should occur when exactly at the limit
        expect(mockPrismaLocal.backupRecord.delete).not.toHaveBeenCalled();
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should delete exactly (totalCount - maxRetention) backups when exceeding limit', async () => {
    await fc.assert(
      fc.asyncProperty(
        maxRetentionArb,
        fc.integer({ min: 1, max: 20 }),
        async (maxRetention, extraCount) => {
          const totalCount = maxRetention + extraCount;
          const mockPrismaLocal = createMockPrismaService();

          const baseDate = new Date('2022-01-01');
          const allRecords = Array.from({ length: totalCount }, (_, i) => ({
            id: `id-${i}`,
            executedAt: new Date(baseDate.getTime() + i * 30 * 24 * 60 * 60 * 1000),
            filePath: `/backups/backup_${i}.tar.gz.enc`,
            status: 'success' as const,
            sizeBytes: BigInt(1024),
            checksum: `checksum_${i}`,
          }));

          const sortedRecords = [...allRecords].sort(
            (a, b) => b.executedAt.getTime() - a.executedAt.getTime(),
          );

          mockPrismaLocal.backupRecord.findMany.mockResolvedValue(sortedRecords);

          const localService = createBackupService(mockPrismaLocal, undefined, {
            BACKUP_RETENTION: maxRetention,
          });

          await localService.enforceRetentionPolicy();

          // Exactly extraCount records should be deleted
          expect(mockPrismaLocal.backupRecord.delete).toHaveBeenCalledTimes(extraCount);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
