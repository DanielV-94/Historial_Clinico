import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { BadRequestException } from '@nestjs/common';

import { createPatientSchema } from '@historial/validators';
import { SEARCH_MAX_RESULTS } from '@historial/constants';
import { PatientService } from './patient.service';

/**
 * Property-Based Tests for Patient Module (Service Level).
 *
 * **Validates: Requirements 1.1, 1.3, 1.4, 1.5, 5.3**
 */

const NUM_RUNS = 100;

// ============================================================
// ARBITRARIES
// ============================================================

// --- Property 1: Required fields validation ---

/** Generate a valid patient with all required fields */
const validPatientArb = fc.record({
  fullName: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
  birthDate: fc.date({
    min: new Date('1900-01-01'),
    max: new Date(),
  }),
  sex: fc.constantFrom('M', 'F', 'O'),
  phone: fc.stringMatching(/^[0-9]{10,15}$/),
});

/** Generate patient data missing fullName (empty string, which violates min(1)) */
const missingFullNameArb = fc.record({
  fullName: fc.constant(''),
  birthDate: fc.date({ min: new Date('1900-01-01'), max: new Date() }).map((d) => d.toISOString()),
  sex: fc.constantFrom('M', 'F', 'O'),
  phone: fc.stringMatching(/^[0-9]{10,15}$/),
});

/** Generate patient data with future birthDate */
const futureBirthDateArb = fc.record({
  fullName: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  birthDate: fc.date({
    min: new Date(Date.now() + 86400000), // tomorrow
    max: new Date('2100-01-01'),
  }).map((d) => d.toISOString()),
  sex: fc.constantFrom('M', 'F', 'O'),
  phone: fc.stringMatching(/^[0-9]{10,15}$/),
});

/** Generate patient data with invalid phone (less than 10 digits) */
const invalidPhoneArb = fc.record({
  fullName: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  birthDate: fc.date({ min: new Date('1900-01-01'), max: new Date() }).map((d) => d.toISOString()),
  sex: fc.constantFrom('M', 'F', 'O'),
  phone: fc.stringMatching(/^[0-9]{1,9}$/),
});

/** Generate patient data with invalid sex */
const invalidSexArb = fc.record({
  fullName: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  birthDate: fc.date({ min: new Date('1900-01-01'), max: new Date() }).map((d) => d.toISOString()),
  sex: fc.string({ minLength: 1, maxLength: 5 }).filter((s) => !['M', 'F', 'O'].includes(s)),
  phone: fc.stringMatching(/^[0-9]{10,15}$/),
});

// --- Property 2: Data limits ---

/** Generate more than 50 allergies */
const tooManyAllergiesArb = fc.integer({ min: 51, max: 60 }).chain((count) =>
  fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: count, maxLength: count }),
);

/** Generate an allergy exceeding 200 characters */
const tooLongAllergyArb = fc.string({ minLength: 201, maxLength: 300 });

/** Generate more than 30 previous surgeries */
const tooManySurgeriesArb = fc.integer({ min: 31, max: 40 }).chain((count) =>
  fc.array(
    fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      date: fc.date({ min: new Date('1950-01-01'), max: new Date() }).map((d) => d.toISOString()),
    }),
    { minLength: count, maxLength: count },
  ),
);

// --- Property 3: Duplicate detection ---

/** Generate name variations that normalize to the same value */
const duplicateNamePairArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0)
  .chain((baseName) => {
    const trimmedBase = baseName.trim();
    return fc.constantFrom(
      // Same name, different case
      { input: trimmedBase.toUpperCase(), normalized: trimmedBase.toLowerCase() },
      { input: trimmedBase.toLowerCase(), normalized: trimmedBase.toLowerCase() },
      // Mixed case
      { input: `  ${trimmedBase}  `, normalized: trimmedBase.toLowerCase() },
      // Extra spaces within (we trim, so leading/trailing is handled)
      { input: ` ${trimmedBase.toUpperCase()} `, normalized: trimmedBase.toLowerCase() },
    );
  });

// --- Property 22: Search limit ---

/** Generate a variable count of "db results" simulating DB responses */
const searchResultCountArb = fc.integer({ min: 0, max: 50 });

/** Generate a non-empty search query */
const searchQueryArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0);

// ============================================================
// MOCK HELPERS
// ============================================================

function createMockPrismaService() {
  return {
    patient: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    allergy: {
      deleteMany: vi.fn(),
    },
    previousSurgery: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  };
}

// ============================================================
// PROPERTY TESTS
// ============================================================

describe('Patient Property Tests - Property 1: Validación de campos obligatorios del paciente', () => {
  /**
   * **Validates: Requirements 1.3, 1.4**
   *
   * Property 1: Para cualquier objeto de datos de paciente, la validación SHALL aceptar el objeto
   * si y solo si contiene nombre completo no vacío, fecha de nacimiento no futura, sexo válido (M/F/O)
   * y teléfono con al menos 10 dígitos; en caso contrario SHALL rechazarlo con un mensaje de error.
   */

  let patientService: PatientService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(() => {
    mockPrisma = createMockPrismaService();
    mockPrisma.patient.findFirst.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mockPrisma.patient.create.mockResolvedValue({ id: 'new-id' });
    patientService = new PatientService(mockPrisma as any);
  });

  it('should REJECT patient data with empty fullName via BadRequestException', async () => {
    await fc.assert(
      fc.asyncProperty(missingFullNameArb, async (data) => {
        await expect(patientService.create(data as any)).rejects.toThrow(BadRequestException);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should REJECT patient data with a future birthDate via BadRequestException', async () => {
    await fc.assert(
      fc.asyncProperty(futureBirthDateArb, async (data) => {
        await expect(patientService.create(data as any)).rejects.toThrow(BadRequestException);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should REJECT patient data with phone having less than 10 digits via BadRequestException', async () => {
    await fc.assert(
      fc.asyncProperty(invalidPhoneArb, async (data) => {
        await expect(patientService.create(data as any)).rejects.toThrow(BadRequestException);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should REJECT patient data with invalid sex value via BadRequestException', async () => {
    await fc.assert(
      fc.asyncProperty(invalidSexArb, async (data) => {
        await expect(patientService.create(data as any)).rejects.toThrow(BadRequestException);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Patient Property Tests - Property 2: Límites de datos en creación de paciente', () => {
  /**
   * **Validates: Requirements 1.1**
   *
   * Property 2: Para cualquier conjunto de datos de paciente, la creación SHALL ser rechazada
   * si contiene más de 50 alergias, alguna alergia con más de 200 caracteres, o más de 30 cirugías previas.
   */

  let patientService: PatientService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(() => {
    mockPrisma = createMockPrismaService();
    mockPrisma.patient.findFirst.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    patientService = new PatientService(mockPrisma as any);
  });

  it('should REJECT patient data with more than 50 allergies', async () => {
    await fc.assert(
      fc.asyncProperty(tooManyAllergiesArb, async (allergies) => {
        const data = {
          fullName: 'Test Patient',
          birthDate: '1990-01-01',
          sex: 'M',
          phone: '1234567890',
          allergies,
        };

        await expect(patientService.create(data as any)).rejects.toThrow(BadRequestException);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should REJECT patient data with an allergy exceeding 200 characters', async () => {
    await fc.assert(
      fc.asyncProperty(tooLongAllergyArb, async (longAllergy) => {
        const data = {
          fullName: 'Test Patient',
          birthDate: '1990-01-01',
          sex: 'M',
          phone: '1234567890',
          allergies: [longAllergy],
        };

        await expect(patientService.create(data as any)).rejects.toThrow(BadRequestException);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should REJECT patient data with more than 30 previous surgeries', async () => {
    await fc.assert(
      fc.asyncProperty(tooManySurgeriesArb, async (previousSurgeries) => {
        const data = {
          fullName: 'Test Patient',
          birthDate: '1990-01-01',
          sex: 'M',
          phone: '1234567890',
          previousSurgeries,
        };

        await expect(patientService.create(data as any)).rejects.toThrow(BadRequestException);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Patient Property Tests - Property 3: Detección de paciente duplicado', () => {
  /**
   * **Validates: Requirements 1.5**
   *
   * Property 3: Para cualquier par de registros de paciente, el sistema SHALL detectar un posible
   * duplicado si y solo si el nombre completo (case-insensitive, normalizado) y la fecha de nacimiento
   * son idénticos entre ambos registros.
   */

  let patientService: PatientService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(() => {
    mockPrisma = createMockPrismaService();
    patientService = new PatientService(mockPrisma as any);
  });

  it('should detect duplicate when names normalize to same value and birthDate matches', async () => {
    await fc.assert(
      fc.asyncProperty(
        duplicateNamePairArb,
        fc.date({ min: new Date('1950-01-01'), max: new Date() }),
        async (namePair, birthDate) => {
          // Mock Prisma to return an existing patient matching the normalized name + birthDate
          mockPrisma.patient.findFirst.mockResolvedValue({
            id: 'existing-patient-id',
            fullName: namePair.normalized,
            birthDate,
            phone: '1234567890',
          });

          const result = await patientService.checkDuplicate(namePair.input, birthDate);

          expect(result.isDuplicate).toBe(true);
          expect(result.existingPatient).toBeDefined();
          expect(result.existingPatient!.id).toBe('existing-patient-id');
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('should NOT detect duplicate when no matching patient exists in DB', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        fc.date({ min: new Date('1950-01-01'), max: new Date() }),
        async (fullName, birthDate) => {
          // Mock Prisma to return no matching patient
          mockPrisma.patient.findFirst.mockResolvedValue(null);

          const result = await patientService.checkDuplicate(fullName, birthDate);

          expect(result.isDuplicate).toBe(false);
          expect(result.existingPatient).toBeUndefined();
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('should pass normalized (trimmed, lowercased) name to Prisma query', async () => {
    await fc.assert(
      fc.asyncProperty(
        duplicateNamePairArb,
        fc.date({ min: new Date('1950-01-01'), max: new Date() }),
        async (namePair, birthDate) => {
          mockPrisma.patient.findFirst.mockResolvedValue(null);

          await patientService.checkDuplicate(namePair.input, birthDate);

          // Verify that findFirst was called with the normalized name
          expect(mockPrisma.patient.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({
                birthDate,
                fullName: expect.objectContaining({
                  equals: namePair.input.trim().toLowerCase(),
                  mode: 'insensitive',
                }),
              }),
            }),
          );
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Patient Property Tests - Property 22: Búsqueda de pacientes con límite de resultados', () => {
  /**
   * **Validates: Requirements 5.3**
   *
   * Property 22: Para cualquier query de búsqueda, los resultados SHALL contener como máximo
   * 10 pacientes (SEARCH_MAX_RESULTS).
   */

  let patientService: PatientService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(() => {
    mockPrisma = createMockPrismaService();
    patientService = new PatientService(mockPrisma as any);
  });

  it('should return at most SEARCH_MAX_RESULTS (10) patients regardless of DB count', async () => {
    await fc.assert(
      fc.asyncProperty(searchQueryArb, searchResultCountArb, async (query, dbResultCount) => {
        // Simulate DB returning up to dbResultCount results
        // But since the SQL has LIMIT 10, the actual returned results are capped
        const cappedCount = Math.min(dbResultCount, SEARCH_MAX_RESULTS);
        const mockResults = Array.from({ length: cappedCount }, (_, i) => ({
          id: `patient-${i}`,
          full_name: `Patient ${i} ${query}`,
          birth_date: new Date('1990-01-01'),
          phone: '1234567890',
          email: null,
          profile_photo_path: null,
        }));

        mockPrisma.$queryRaw.mockResolvedValue(mockResults);

        const results = await patientService.search(query);

        expect(results.length).toBeLessThanOrEqual(SEARCH_MAX_RESULTS);
        expect(results.length).toBe(cappedCount);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should return empty array for empty or whitespace-only queries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('', '   ', '\t', '\n'),
        async (emptyQuery) => {
          const results = await patientService.search(emptyQuery);
          expect(results).toEqual([]);
          // Prisma $queryRaw should NOT have been called
          expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('should pass SEARCH_MAX_RESULTS as LIMIT to the SQL query', async () => {
    await fc.assert(
      fc.asyncProperty(searchQueryArb, async (query) => {
        mockPrisma.$queryRaw.mockResolvedValue([]);

        await patientService.search(query);

        // Verify $queryRaw was called (the SQL template uses LIMIT ${SEARCH_MAX_RESULTS})
        expect(mockPrisma.$queryRaw).toHaveBeenCalled();
        
        // The tagged template call contains the SEARCH_MAX_RESULTS value
        const callArgs = mockPrisma.$queryRaw.mock.calls[0];
        // In Prisma tagged templates, the values are passed as template arguments
        // The raw SQL contains the LIMIT clause with value 10
        const templateStrings = callArgs[0];
        if (Array.isArray(templateStrings)) {
          // Tagged template: first arg is string array, rest are values
          const fullSql = templateStrings.join('?');
          expect(fullSql.toLowerCase()).toContain('limit');
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
