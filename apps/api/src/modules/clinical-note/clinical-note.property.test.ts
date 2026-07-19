import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { BadRequestException } from '@nestjs/common';
import { ClinicalNoteService } from './clinical-note.service';
import { PrismaService } from '../../database/prisma.service';
import { NOTE_MIN_LENGTH, NOTE_MAX_LENGTH } from '@historial/validators';

/**
 * Property-based tests for ClinicalNoteService.
 *
 * **Validates: Requirements 4.1, 4.2, 4.4, 6.3**
 *
 * Property 8: Validación de notas clínicas
 * Para cualquier string de contenido de nota clínica, la validación SHALL aceptarlo
 * si y solo si su longitud es ≥ 1 y ≤ 10,000 caracteres; cadenas vacías o que excedan
 * el límite SHALL ser rechazadas con un mensaje indicando la restricción incumplida.
 *
 * Property 6: Ordenamiento cronológico de listados
 * Para cualquier listado retornado por los endpoints de notas clínicas y prescripciones
 * de un paciente, los elementos SHALL estar ordenados por fecha descendente (más reciente primero).
 */

const NUM_RUNS = 100;

// ============================================================
// ARBITRARIES
// ============================================================

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

/** Generate valid clinical note content (1–10,000 chars) */
const validContentArb = fc
  .integer({ min: NOTE_MIN_LENGTH, max: NOTE_MAX_LENGTH })
  .chain((len) =>
    fc.string({ minLength: len, maxLength: len }).filter((s) => s.length === len),
  );

/** Generate empty content (always empty string) */
const emptyContentArb = fc.constant('');

/** Generate content exceeding 10,000 characters */
const exceedingContentArb = fc
  .integer({ min: NOTE_MAX_LENGTH + 1, max: NOTE_MAX_LENGTH + 500 })
  .map((len) => 'A'.repeat(len));

/** Generate a random date within a reasonable range */
const dateArb = fc
  .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') });

/** Generate an array of random dates (2–20 items) */
const datesArrayArb = fc.array(dateArb, { minLength: 2, maxLength: 20 });

// ============================================================
// MOCK SETUP
// ============================================================

function createMockPrismaService() {
  return {
    clinicalNote: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };
}

// ============================================================
// PROPERTY TESTS — Property 8: Validación de notas clínicas
// ============================================================

describe('ClinicalNoteService - Property 8: Validación de notas clínicas', () => {
  let service: ClinicalNoteService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(() => {
    mockPrisma = createMockPrismaService();
    service = new ClinicalNoteService(mockPrisma as unknown as PrismaService);
  });

  it('should accept any content with length between 1 and 10,000 chars', async () => {
    await fc.assert(
      fc.asyncProperty(uuidArb, uuidArb, validContentArb, async (patientId, authorId, content) => {
        const mockNote = {
          id: 'note-uuid',
          patientId,
          authorId,
          content,
          createdAt: new Date(),
        };
        mockPrisma.clinicalNote.create.mockResolvedValue(mockNote);

        const result = await service.create(patientId, authorId, content);

        expect(result).toBeDefined();
        expect(result.content).toBe(content);
        expect(mockPrisma.clinicalNote.create).toHaveBeenCalledWith({
          data: { patientId, authorId, content },
        });
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should reject empty content with BadRequestException', async () => {
    await fc.assert(
      fc.asyncProperty(uuidArb, uuidArb, emptyContentArb, async (patientId, authorId, content) => {
        await expect(
          service.create(patientId, authorId, content),
        ).rejects.toThrow(BadRequestException);

        // Prisma create should NOT be called for invalid content
        expect(mockPrisma.clinicalNote.create).not.toHaveBeenCalled();
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should reject content exceeding 10,000 chars with BadRequestException', async () => {
    await fc.assert(
      fc.asyncProperty(uuidArb, uuidArb, exceedingContentArb, async (patientId, authorId, content) => {
        await expect(
          service.create(patientId, authorId, content),
        ).rejects.toThrow(BadRequestException);

        // Prisma create should NOT be called for invalid content
        expect(mockPrisma.clinicalNote.create).not.toHaveBeenCalled();
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should include error message indicating the constraint violated', async () => {
    await fc.assert(
      fc.asyncProperty(uuidArb, uuidArb, exceedingContentArb, async (patientId, authorId, content) => {
        try {
          await service.create(patientId, authorId, content);
          // Should not reach here
          expect(true).toBe(false);
        } catch (error) {
          expect(error).toBeInstanceOf(BadRequestException);
          const response = (error as BadRequestException).getResponse() as any;
          expect(response.errors).toBeDefined();
          expect(response.errors.length).toBeGreaterThan(0);
          expect(response.errors[0].field).toBe('content');
          expect(response.errors[0].message).toBeDefined();
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ============================================================
// PROPERTY TESTS — Property 6: Ordenamiento cronológico
// ============================================================

describe('ClinicalNoteService - Property 6: Ordenamiento cronológico', () => {
  let service: ClinicalNoteService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(() => {
    mockPrisma = createMockPrismaService();
    service = new ClinicalNoteService(mockPrisma as unknown as PrismaService);
  });

  it('should return notes ordered by createdAt DESC (each date >= next date)', async () => {
    await fc.assert(
      fc.asyncProperty(uuidArb, datesArrayArb, async (patientId, dates) => {
        // Sort dates DESC to simulate what Prisma would return
        const sortedDates = [...dates].sort((a, b) => b.getTime() - a.getTime());

        // Create mock notes in DESC order (as Prisma would return them)
        const mockNotes = sortedDates.map((date, i) => ({
          id: `note-${i}`,
          patientId,
          authorId: 'author-uuid',
          content: `Note content ${i}`,
          createdAt: date,
        }));

        mockPrisma.clinicalNote.findMany.mockResolvedValue(mockNotes);
        mockPrisma.clinicalNote.count.mockResolvedValue(mockNotes.length);

        const result = await service.findByPatient(patientId, 1, 20);

        // Verify the service requests DESC ordering from Prisma
        expect(mockPrisma.clinicalNote.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { createdAt: 'desc' },
          }),
        );

        // Verify the returned data maintains DESC order
        const returnedDates = result.data.map((note) => note.createdAt);
        for (let i = 0; i < returnedDates.length - 1; i++) {
          const current = new Date(returnedDates[i]).getTime();
          const next = new Date(returnedDates[i + 1]).getTime();
          expect(current).toBeGreaterThanOrEqual(next);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should always request createdAt DESC ordering regardless of page', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        fc.integer({ min: 1, max: 50 }),
        async (patientId, page) => {
          mockPrisma.clinicalNote.findMany.mockResolvedValue([]);
          mockPrisma.clinicalNote.count.mockResolvedValue(0);

          await service.findByPatient(patientId, page, 20);

          expect(mockPrisma.clinicalNote.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              orderBy: { createdAt: 'desc' },
            }),
          );
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('should preserve DESC order for single-element result sets', async () => {
    await fc.assert(
      fc.asyncProperty(uuidArb, dateArb, async (patientId, date) => {
        const mockNote = {
          id: 'note-1',
          patientId,
          authorId: 'author-uuid',
          content: 'Single note',
          createdAt: date,
        };

        mockPrisma.clinicalNote.findMany.mockResolvedValue([mockNote]);
        mockPrisma.clinicalNote.count.mockResolvedValue(1);

        const result = await service.findByPatient(patientId, 1, 20);

        expect(result.data).toHaveLength(1);
        expect(result.data[0].createdAt).toEqual(date);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
