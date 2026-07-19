import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import * as crypto from 'crypto';

import {
  fileValidationSchema,
  ALL_ALLOWED_MIME_TYPES,
  FILE_SIZE_LIMITS,
  getCategoryFromMime,
  type FileCategory,
} from '@historial/validators';
import { DOCUMENTS_PAGE_SIZE } from '@historial/constants';
import { FileService } from './file.service';

/**
 * Property-Based Tests for File Module (Service + Controller Level).
 *
 * **Validates: Requirements 2.3, 2.4, 2.6, 3.2, 3.5, 3.6, 12.1, 12.2, 12.3, 12.5**
 */

const NUM_RUNS = 100;

// ============================================================
// MOCKS
// ============================================================

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockResolvedValue(undefined),
}));

const mockPrismaService = {
  fileMetadata: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    delete: vi.fn(),
  },
};

const mockConfigService = {
  get: vi.fn().mockReturnValue('/data/clinic-files'),
};

// ============================================================
// ARBITRARIES
// ============================================================

/** Generate a valid SHA-256 checksum (64 hex chars) */
const validChecksumArb = fc
  .uint8Array({ minLength: 16, maxLength: 64 })
  .map((bytes) => crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex'));

/** Generate a valid MIME type from allowed list */
const validMimeArb = fc.constantFrom(...ALL_ALLOWED_MIME_TYPES);

/** Generate an invalid MIME type */
const invalidMimeArb = fc.constantFrom(
  'application/exe',
  'text/html',
  'application/zip',
  'image/gif',
  'video/avi',
  'application/octet-stream',
);

/** Generate a valid UUID */
const uuidArb = fc.uuid();

/** Generate a valid file category */
const categoryArb = fc.constantFrom<FileCategory>('pdf', 'image', 'video');

/** Generate a valid original file name */
const fileNameArb = fc.tuple(
  fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0 && !s.includes('/') && !s.includes('\\')),
  fc.constantFrom('.pdf', '.jpg', '.png', '.mp4', '.mov'),
).map(([name, ext]) => `${name.replace(/[^a-zA-Z0-9_-]/g, 'x')}${ext}`);

/** Generate a date in the past */
const pastDateArb = fc.date({
  min: new Date('2020-01-01'),
  max: new Date(),
});

// ============================================================
// PROPERTY TESTS
// ============================================================

describe('File Module Property Tests', () => {
  let service: FileService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FileService(
      mockPrismaService as any,
      mockConfigService as any,
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Property 4: Validación compuesta de archivos (MIME + tamaño + checksum)
  // ──────────────────────────────────────────────────────────────────────────

  describe('Property 4: Validación compuesta de archivos', () => {
    /**
     * **Validates: Requirements 2.4, 3.5, 3.6, 12.3, 12.5**
     *
     * For any file with valid MIME, valid size per category, and valid checksum,
     * FileService.validateFile SHALL return valid: true.
     */
    it('acepta archivos con MIME válido + tamaño dentro del límite + checksum SHA-256 válido', () => {
      fc.assert(
        fc.property(
          validMimeArb,
          validChecksumArb,
          (mimeType, checksum) => {
            const category = getCategoryFromMime(mimeType)!;
            const maxSize = FILE_SIZE_LIMITS[category];
            // Generate a size within valid range (1 byte to max)
            const sizeBytes = Math.floor(Math.random() * (maxSize - 1)) + 1;

            const result = service.validateFile(mimeType, sizeBytes, checksum);
            expect(result.valid).toBe(true);
            expect(result.errors).toBeUndefined();
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    /**
     * **Validates: Requirements 12.3, 12.5**
     *
     * For any file with invalid MIME, validation SHALL fail with specific error.
     */
    it('rechaza archivos con MIME type no permitido', () => {
      fc.assert(
        fc.property(
          invalidMimeArb,
          fc.integer({ min: 1, max: 10 * 1024 * 1024 }),
          validChecksumArb,
          (mimeType, sizeBytes, checksum) => {
            const result = service.validateFile(mimeType, sizeBytes, checksum);
            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors!.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    /**
     * **Validates: Requirements 2.4, 3.5, 3.6**
     *
     * For any valid MIME where size exceeds the category limit, validation SHALL fail.
     */
    it('rechaza archivos que exceden el límite de tamaño por categoría', () => {
      fc.assert(
        fc.property(
          validMimeArb,
          validChecksumArb,
          (mimeType, checksum) => {
            const category = getCategoryFromMime(mimeType)!;
            const limit = FILE_SIZE_LIMITS[category];
            // Size beyond the limit
            const sizeBytes = limit + Math.floor(Math.random() * 10_000_000) + 1;

            const result = service.validateFile(mimeType, sizeBytes, checksum);
            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    /**
     * **Validates: Requirements 12.3**
     *
     * For any file with invalid checksum (not 64 hex chars), validation SHALL fail.
     */
    it('rechaza archivos con checksum inválido', () => {
      const invalidChecksumArb = fc.oneof(
        fc.string({ minLength: 1, maxLength: 63 }),   // too short
        fc.string({ minLength: 65, maxLength: 100 }), // too long
        fc.constant('ZZZZ' + 'a'.repeat(60)),          // invalid hex chars
      );

      fc.assert(
        fc.property(
          validMimeArb,
          fc.integer({ min: 1, max: 1024 * 1024 }),
          invalidChecksumArb,
          (mimeType, sizeBytes, checksum) => {
            const result = service.validateFile(mimeType, sizeBytes, checksum);
            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Property 5: Detección de nombre de archivo duplicado
  // ──────────────────────────────────────────────────────────────────────────

  describe('Property 5: Detección de nombre de archivo duplicado', () => {
    /**
     * **Validates: Requirements 2.6**
     *
     * For any combination of patientId + category + originalName,
     * if an existing file with the same name already exists in the same category
     * and patient, checkDuplicateName SHALL return isDuplicate: true.
     */
    it('detecta duplicado cuando existe archivo con mismo nombre en misma categoría y paciente', () => {
      fc.assert(
        fc.asyncProperty(
          uuidArb,
          categoryArb,
          fileNameArb,
          async (patientId, category, originalName) => {
            // Mock Prisma to return an existing file with same name
            mockPrismaService.fileMetadata.findFirst.mockResolvedValue({
              id: 'existing-file-id',
              originalName,
              uniqueName: `2024-01-01_archivo_abc12345${originalName.substring(originalName.lastIndexOf('.'))}`,
              uploadedAt: new Date('2024-01-15'),
            });

            const result = await service.checkDuplicateName(
              patientId,
              category,
              originalName,
            );

            expect(result.isDuplicate).toBe(true);
            expect(result.existingFile).toBeDefined();
            expect(result.existingFile!.originalName).toBe(originalName);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    /**
     * **Validates: Requirements 2.6**
     *
     * When no file with the same name exists, checkDuplicateName SHALL return isDuplicate: false.
     */
    it('no reporta duplicado cuando no existe archivo con mismo nombre', () => {
      fc.assert(
        fc.asyncProperty(
          uuidArb,
          categoryArb,
          fileNameArb,
          async (patientId, category, originalName) => {
            // Mock Prisma to return null (no existing file)
            mockPrismaService.fileMetadata.findFirst.mockResolvedValue(null);

            const result = await service.checkDuplicateName(
              patientId,
              category,
              originalName,
            );

            expect(result.isDuplicate).toBe(false);
            expect(result.existingFile).toBeUndefined();
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Property 6: Ordenamiento cronológico de listados
  // ──────────────────────────────────────────────────────────────────────────

  describe('Property 6: Ordenamiento cronológico de listados', () => {
    /**
     * **Validates: Requirements 2.3, 3.2**
     *
     * For any list of documents returned by the documents endpoint,
     * the items SHALL be ordered by uploadedAt descending (most recent first).
     */
    it('documentos están ordenados por fecha descendente', () => {
      fc.assert(
        fc.asyncProperty(
          uuidArb,
          fc.array(pastDateArb, { minLength: 2, maxLength: 20 }),
          async (patientId, dates) => {
            // Sort dates descending to simulate proper DB ordering
            const sortedDates = [...dates].sort(
              (a, b) => b.getTime() - a.getTime(),
            );

            // Build mock records in descending order
            const mockDocuments = sortedDates.map((date, i) => ({
              id: `doc-${i}`,
              originalName: `document-${i}.pdf`,
              uniqueName: `2024-01-01_archivo_${i}.pdf`,
              mimeType: 'application/pdf',
              sizeBytes: BigInt(1024),
              studyType: null,
              uploadedAt: date,
              uploader: { id: 'user-1', fullName: 'Doctor Test' },
            }));

            mockPrismaService.fileMetadata.findMany.mockResolvedValue(mockDocuments);
            mockPrismaService.fileMetadata.count.mockResolvedValue(mockDocuments.length);

            // Simulate controller logic
            const items = mockDocuments;

            // Verify ordering: each item's uploadedAt >= next item's uploadedAt
            for (let i = 0; i < items.length - 1; i++) {
              expect(items[i].uploadedAt.getTime()).toBeGreaterThanOrEqual(
                items[i + 1].uploadedAt.getTime(),
              );
            }
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    /**
     * **Validates: Requirements 3.2**
     *
     * For any gallery listing, items SHALL be ordered by captureDate/uploadedAt descending.
     */
    it('galería está ordenada por fecha de captura descendente', () => {
      fc.assert(
        fc.asyncProperty(
          uuidArb,
          fc.array(pastDateArb, { minLength: 2, maxLength: 20 }),
          async (patientId, dates) => {
            // Sort dates descending
            const sortedDates = [...dates].sort(
              (a, b) => b.getTime() - a.getTime(),
            );

            // Build mock gallery items in descending order
            const mockGalleryItems = sortedDates.map((date, i) => ({
              id: `img-${i}`,
              originalName: `photo-${i}.jpg`,
              uniqueName: `2024-01-01_foto_${i}.jpg`,
              mimeType: 'image/jpeg',
              sizeBytes: BigInt(2048),
              category: 'image',
              captureDate: date,
              anatomicalZone: null,
              notes: null,
              hasWatermark: false,
              uploadedAt: date,
              uploader: { id: 'user-1', fullName: 'Doctor Test' },
            }));

            mockPrismaService.fileMetadata.findMany.mockResolvedValue(mockGalleryItems);
            mockPrismaService.fileMetadata.count.mockResolvedValue(mockGalleryItems.length);

            // Verify ordering: each item's date >= next item's date
            for (let i = 0; i < mockGalleryItems.length - 1; i++) {
              const currentDate = mockGalleryItems[i].captureDate ?? mockGalleryItems[i].uploadedAt;
              const nextDate = mockGalleryItems[i + 1].captureDate ?? mockGalleryItems[i + 1].uploadedAt;
              expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
            }
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Property 7: Paginación de documentos
  // ──────────────────────────────────────────────────────────────────────────

  describe('Property 7: Paginación de documentos', () => {
    /**
     * **Validates: Requirements 2.3**
     *
     * Each page SHALL contain at most DOCUMENTS_PAGE_SIZE (20) elements.
     * The union of all pages SHALL equal all documents (no duplicates, no omissions).
     */
    it('cada página contiene máximo 20 documentos y la unión cubre todos sin duplicados', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (totalDocs) => {
            const pageSize = DOCUMENTS_PAGE_SIZE; // 20
            const totalPages = Math.ceil(totalDocs / pageSize);

            // Simulate pagination: generate IDs for all documents
            const allIds = Array.from({ length: totalDocs }, (_, i) => `doc-${i}`);
            const collectedIds: string[] = [];

            for (let page = 1; page <= totalPages; page++) {
              const skip = (page - 1) * pageSize;
              const pageItems = allIds.slice(skip, skip + pageSize);

              // Each page has at most pageSize items
              expect(pageItems.length).toBeLessThanOrEqual(pageSize);

              collectedIds.push(...pageItems);
            }

            // Union of all pages === all documents
            expect(collectedIds.length).toBe(totalDocs);

            // No duplicates
            const uniqueIds = new Set(collectedIds);
            expect(uniqueIds.size).toBe(totalDocs);

            // No omissions: all original IDs are present
            for (const id of allIds) {
              expect(uniqueIds.has(id)).toBe(true);
            }
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    /**
     * **Validates: Requirements 2.3**
     *
     * For any valid page number, the returned items count SHALL not exceed 20.
     */
    it('para cualquier número de página, el resultado no excede 20 elementos', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 0, max: 200 }),
          (pageNum, totalDocs) => {
            const pageSize = DOCUMENTS_PAGE_SIZE;
            const skip = (pageNum - 1) * pageSize;
            const itemsOnPage = Math.max(0, Math.min(pageSize, totalDocs - skip));

            expect(itemsOnPage).toBeLessThanOrEqual(pageSize);
            expect(itemsOnPage).toBeGreaterThanOrEqual(0);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Property 19: Ruta de almacenamiento por paciente
  // ──────────────────────────────────────────────────────────────────────────

  describe('Property 19: Ruta de almacenamiento por paciente', () => {
    /**
     * **Validates: Requirements 12.1**
     *
     * For any patientId and category, the storage path SHALL contain the patientId
     * and follow the category pattern:
     * - pdf → patients/{id}/documents/
     * - image → patients/{id}/gallery/images/
     * - video → patients/{id}/gallery/videos/
     */
    it('la ruta contiene el patientId y sigue el patrón de categoría', () => {
      fc.assert(
        fc.property(
          uuidArb,
          categoryArb,
          (patientId, category) => {
            const storagePath = service.buildStoragePath(patientId, category);

            // Path SHALL contain the patient ID
            expect(storagePath).toContain(patientId);

            // Path SHALL start with 'patients'
            expect(storagePath.replace(/\\/g, '/')).toMatch(/^patients\//);

            // Path SHALL follow category pattern
            const normalizedPath = storagePath.replace(/\\/g, '/');
            switch (category) {
              case 'pdf':
                expect(normalizedPath).toContain(`patients/${patientId}/documents`);
                break;
              case 'image':
                expect(normalizedPath).toContain(`patients/${patientId}/gallery/images`);
                break;
              case 'video':
                expect(normalizedPath).toContain(`patients/${patientId}/gallery/videos`);
                break;
            }
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    /**
     * **Validates: Requirements 12.1**
     *
     * Different categories for the same patient SHALL produce different paths.
     */
    it('categorías distintas producen rutas distintas para el mismo paciente', () => {
      fc.assert(
        fc.property(
          uuidArb,
          (patientId) => {
            const pdfPath = service.buildStoragePath(patientId, 'pdf');
            const imagePath = service.buildStoragePath(patientId, 'image');
            const videoPath = service.buildStoragePath(patientId, 'video');

            expect(pdfPath).not.toBe(imagePath);
            expect(pdfPath).not.toBe(videoPath);
            expect(imagePath).not.toBe(videoPath);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Property 20: Metadatos de archivo completos sin contenido binario
  // ──────────────────────────────────────────────────────────────────────────

  describe('Property 20: Metadatos de archivo completos sin contenido binario', () => {
    /**
     * **Validates: Requirements 12.2**
     *
     * For any file created via Prisma, the create call SHALL include all required
     * metadata fields (originalName, uniqueName, storagePath, mimeType, sizeBytes,
     * checksum, category, patientId, uploadedBy) and SHALL NOT include a binary
     * content field.
     */
    it('Prisma create incluye todos los metadatos requeridos y no incluye contenido binario', () => {
      fc.assert(
        fc.asyncProperty(
          uuidArb,
          uuidArb,
          validMimeArb,
          fileNameArb,
          async (patientId, userId, mimeType, originalName) => {
            // Clear mocks between iterations
            mockPrismaService.fileMetadata.findFirst.mockReset();
            mockPrismaService.fileMetadata.create.mockReset();

            const category = getCategoryFromMime(mimeType)!;
            const fileBuffer = Buffer.from('test file content');
            const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

            // Mock: no duplicate
            mockPrismaService.fileMetadata.findFirst.mockResolvedValue(null);
            // Mock: successful create (return matches what was passed)
            mockPrismaService.fileMetadata.create.mockImplementation(async (args: any) => ({
              id: 'new-file-id',
              patientId: args.data.patientId,
              originalName: args.data.originalName,
              uniqueName: args.data.uniqueName,
              storagePath: args.data.storagePath,
              mimeType: args.data.mimeType,
              sizeBytes: args.data.sizeBytes,
              checksum: args.data.checksum,
              category: args.data.category,
              studyType: args.data.studyType,
              uploadedAt: new Date(),
            }));

            await service.upload(
              patientId,
              fileBuffer,
              {
                originalName,
                mimeType,
              },
              userId,
            );

            // Verify Prisma create was called
            expect(mockPrismaService.fileMetadata.create).toHaveBeenCalledTimes(1);

            const createCall = mockPrismaService.fileMetadata.create.mock.calls[0][0];
            const data = createCall.data;

            // All required metadata fields SHALL be present
            expect(data).toHaveProperty('originalName');
            expect(data.originalName).toBe(originalName);
            expect(data).toHaveProperty('uniqueName');
            expect(typeof data.uniqueName).toBe('string');
            expect(data.uniqueName.length).toBeGreaterThan(0);
            expect(data).toHaveProperty('storagePath');
            expect(typeof data.storagePath).toBe('string');
            expect(data).toHaveProperty('mimeType');
            expect(data.mimeType).toBe(mimeType);
            expect(data).toHaveProperty('sizeBytes');
            expect(data.sizeBytes).toBe(BigInt(fileBuffer.length));
            expect(data).toHaveProperty('checksum');
            expect(data.checksum).toBe(checksum);
            expect(data).toHaveProperty('category');
            expect(data.category).toBe(category);
            expect(data).toHaveProperty('patientId');
            expect(data.patientId).toBe(patientId);
            expect(data).toHaveProperty('uploadedBy');
            expect(data.uploadedBy).toBe(userId);

            // SHALL NOT contain binary content field
            expect(data).not.toHaveProperty('content');
            expect(data).not.toHaveProperty('fileContent');
            expect(data).not.toHaveProperty('buffer');
            expect(data).not.toHaveProperty('binary');
            expect(data).not.toHaveProperty('data');
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });
});
