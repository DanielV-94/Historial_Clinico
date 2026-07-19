import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { BadRequestException } from '@nestjs/common';
import { AIService, PatientHistoryData, ClinicalSummary } from './ai.service';
import { PrismaService } from '../../database/prisma.service';

/**
 * **Validates: Requirements 14.1, 14.3**
 *
 * Property 18: Estructura completa del resumen clínico IA
 * Para cualquier historial de paciente con al menos 1 nota de evolución,
 * el resumen generado por el Motor_IA SHALL contener todas las secciones
 * requeridas (diagnósticos, tratamientos realizados, alergias, recomendaciones)
 * y SHALL incluir todos los diagnósticos registrados, todos los tratamientos,
 * todas las alergias y las recomendaciones de las últimas 10 notas.
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

/** Generate a non-empty patient name */
const patientNameArb = fc
  .string({ minLength: 2, maxLength: 100 })
  .filter((s) => s.trim().length >= 2);

/** Generate a diagnosis string (non-empty) */
const diagnosisArb = fc
  .string({ minLength: 3, maxLength: 200 })
  .filter((s) => s.trim().length >= 3 && !s.includes('\n'));

/** Generate a treatment string (non-empty) */
const treatmentArb = fc
  .string({ minLength: 3, maxLength: 200 })
  .filter((s) => s.trim().length >= 3 && !s.includes('\n'));

/** Generate an allergy description */
const allergyArb = fc
  .string({ minLength: 2, maxLength: 200 })
  .filter((s) => s.trim().length >= 2 && !s.includes('\n'));

/** Generate a recommendation string */
const recommendationArb = fc
  .string({ minLength: 3, maxLength: 300 })
  .filter((s) => s.trim().length >= 3 && !s.includes('\n'));

/** Generate a random date within a reasonable range */
const dateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') });

/** Generate a clinical note with embedded diagnoses and recommendations */
const noteWithDiagnosisArb = (diagnosis: string) =>
  fc.constant(`Paciente presenta síntomas. Diagnóstico: ${diagnosis}`);

const noteWithRecommendationArb = (recommendation: string) =>
  fc.constant(`Evolución favorable. Recomendación: ${recommendation}`);

/** Generate a note content with both diagnosis and recommendation */
const noteWithBothArb = (diagnosis: string, recommendation: string) =>
  fc.constant(`Evaluación completa.\nDiagnóstico: ${diagnosis}\nRecomendación: ${recommendation}`);

/** Generate a plain note (no structured data) */
const plainNoteContentArb = fc
  .string({ minLength: 5, maxLength: 500 })
  .filter((s) => {
    const lower = s.toLowerCase();
    return (
      s.trim().length >= 5 &&
      !lower.includes('diagnóstico:') &&
      !lower.includes('diagnostico:') &&
      !lower.includes('dx:') &&
      !lower.includes('recomendación:') &&
      !lower.includes('recomendacion:') &&
      !lower.includes('recomendaciones:')
    );
  });

/**
 * Generate a complete PatientHistoryData with at least 1 note.
 * This arbitrary creates a valid patient history with:
 * - 1 to 15 notes (at least 1 required)
 * - 0 to 10 diagnoses (embedded in notes)
 * - 0 to 10 treatments
 * - 0 to 10 allergies
 * - 0 to 10 recommendations (embedded in last 10 notes)
 */
const patientHistoryArb: fc.Arbitrary<PatientHistoryData> = fc
  .tuple(
    uuidArb,
    patientNameArb,
    fc.array(diagnosisArb, { minLength: 0, maxLength: 10 }),
    fc.array(treatmentArb, { minLength: 0, maxLength: 10 }),
    fc.array(allergyArb, { minLength: 0, maxLength: 10 }),
    fc.array(recommendationArb, { minLength: 0, maxLength: 10 }),
    fc.array(dateArb, { minLength: 1, maxLength: 15 }),
  )
  .map(([patientId, patientName, diagnosticos, tratamientos, alergias, recomendaciones, dates]) => {
    // Sort dates descending (most recent first)
    const sortedDates = [...dates].sort((a, b) => b.getTime() - a.getTime());

    // Build notes with embedded diagnoses and recommendations
    const notas: { content: string; createdAt: Date }[] = [];

    for (let i = 0; i < sortedDates.length; i++) {
      let content = `Nota de evolución ${i + 1}. Paciente en consulta.`;

      // Embed diagnosis in notes
      if (i < diagnosticos.length) {
        content += `\nDiagnóstico: ${diagnosticos[i]}`;
      }

      // Embed recommendations in last 10 notes only
      if (i < 10 && i < recomendaciones.length) {
        content += `\nRecomendación: ${recomendaciones[i]}`;
      }

      notas.push({ content, createdAt: sortedDates[i] });
    }

    return {
      patientId,
      patientName,
      diagnosticos,
      tratamientos,
      alergias,
      notas,
    };
  });

/**
 * Generate a PatientHistoryData with NO notes (for testing validation).
 */
const emptyHistoryArb: fc.Arbitrary<PatientHistoryData> = fc
  .tuple(uuidArb, patientNameArb)
  .map(([patientId, patientName]) => ({
    patientId,
    patientName,
    diagnosticos: [],
    tratamientos: [],
    alergias: [],
    notas: [],
  }));

/**
 * Generate a PatientHistoryData with more than 10 notes
 * to test the "last 10 notes" recommendation limit.
 * Uses unique prefixes to ensure recommendations are distinguishable.
 */
const historyWithManyNotesArb: fc.Arbitrary<{
  history: PatientHistoryData;
  recsInLast10: string[];
  recsAfter10: string[];
}> = fc
  .tuple(
    uuidArb,
    patientNameArb,
    fc.array(
      fc.integer({ min: 1000, max: 9999 }).map((n) => `RecLast10_${n}`),
      { minLength: 1, maxLength: 5 },
    ),
    fc.array(
      fc.integer({ min: 1000, max: 9999 }).map((n) => `RecAfter10_${n}`),
      { minLength: 1, maxLength: 5 },
    ),
    fc.array(dateArb, { minLength: 15, maxLength: 20 }),
  )
  .map(([patientId, patientName, recsInLast10, recsAfter10, dates]) => {
    const sortedDates = [...dates].sort((a, b) => b.getTime() - a.getTime());

    const notas: { content: string; createdAt: Date }[] = [];

    // First 10 notes: include recsInLast10 (these should be in the summary)
    for (let i = 0; i < 10 && i < sortedDates.length; i++) {
      let content = `Nota reciente ${i + 1}.`;
      if (i < recsInLast10.length) {
        content += `\nRecomendación: ${recsInLast10[i]}`;
      }
      notas.push({ content, createdAt: sortedDates[i] });
    }

    // Notes 11+: include recsAfter10 (these should NOT be in the summary)
    for (let i = 10; i < sortedDates.length; i++) {
      let content = `Nota antigua ${i + 1}.`;
      if (i - 10 < recsAfter10.length) {
        content += `\nRecomendación: ${recsAfter10[i - 10]}`;
      }
      notas.push({ content, createdAt: sortedDates[i] });
    }

    return {
      history: {
        patientId,
        patientName,
        diagnosticos: [],
        tratamientos: [],
        alergias: [],
        notas,
      },
      recsInLast10,
      recsAfter10,
    };
  });

// ============================================================
// MOCK SETUP
// ============================================================

function createMockPrismaService() {
  return {
    patient: {
      findUnique: vi.fn(),
    },
  };
}

// ============================================================
// PROPERTY TESTS — Property 18: Estructura completa del resumen clínico IA
// ============================================================

describe('AIService - Property 18: Estructura completa del resumen clínico IA', () => {
  let service: AIService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(() => {
    mockPrisma = createMockPrismaService();
    service = new AIService(mockPrisma as unknown as PrismaService);
  });

  it('should always include all 4 required sections (diagnósticos, tratamientos, alergias, recomendaciones)', async () => {
    await fc.assert(
      fc.asyncProperty(patientHistoryArb, async (historyData) => {
        const summary = service.buildSummary(historyData);

        // All 4 required sections must exist
        expect(summary.sections).toHaveProperty('diagnosticos');
        expect(summary.sections).toHaveProperty('tratamientos');
        expect(summary.sections).toHaveProperty('alergias');
        expect(summary.sections).toHaveProperty('recomendaciones');

        // Each section must be an array
        expect(Array.isArray(summary.sections.diagnosticos)).toBe(true);
        expect(Array.isArray(summary.sections.tratamientos)).toBe(true);
        expect(Array.isArray(summary.sections.alergias)).toBe(true);
        expect(Array.isArray(summary.sections.recomendaciones)).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should include ALL diagnoses registered in the patient history', async () => {
    await fc.assert(
      fc.asyncProperty(patientHistoryArb, async (historyData) => {
        const summary = service.buildSummary(historyData);

        // Every diagnosis from the input must appear in the summary
        for (const diag of historyData.diagnosticos) {
          expect(summary.sections.diagnosticos).toContain(diag);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should include ALL treatments registered in the patient history', async () => {
    await fc.assert(
      fc.asyncProperty(patientHistoryArb, async (historyData) => {
        const summary = service.buildSummary(historyData);

        // Every treatment from the input must appear in the summary
        for (const treatment of historyData.tratamientos) {
          expect(summary.sections.tratamientos).toContain(treatment);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should include ALL allergies registered in the patient history', async () => {
    await fc.assert(
      fc.asyncProperty(patientHistoryArb, async (historyData) => {
        const summary = service.buildSummary(historyData);

        // Every allergy from the input must appear in the summary
        for (const allergy of historyData.alergias) {
          expect(summary.sections.alergias).toContain(allergy);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should include recommendations only from the last 10 notes', async () => {
    await fc.assert(
      fc.asyncProperty(historyWithManyNotesArb, async ({ history, recsInLast10, recsAfter10 }) => {
        const summary = service.buildSummary(history);

        // Recommendations from last 10 notes should be included
        for (const rec of recsInLast10) {
          expect(summary.sections.recomendaciones).toContain(rec);
        }

        // Recommendations from notes beyond the 10th should NOT be included
        for (const rec of recsAfter10) {
          expect(summary.sections.recomendaciones).not.toContain(rec);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should have status COMPLETADO for any valid patient history with at least 1 note', async () => {
    await fc.assert(
      fc.asyncProperty(patientHistoryArb, async (historyData) => {
        const summary = service.buildSummary(historyData);

        expect(summary.status).toBe('COMPLETADO');
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should include patientId and patientName in the summary', async () => {
    await fc.assert(
      fc.asyncProperty(patientHistoryArb, async (historyData) => {
        const summary = service.buildSummary(historyData);

        expect(summary.patientId).toBe(historyData.patientId);
        expect(summary.patientName).toBe(historyData.patientName);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should include a valid ISO 8601 generatedAt timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(patientHistoryArb, async (historyData) => {
        const summary = service.buildSummary(historyData);

        // generatedAt must be a valid ISO 8601 date
        const parsed = new Date(summary.generatedAt);
        expect(parsed.toISOString()).toBe(summary.generatedAt);
        expect(isNaN(parsed.getTime())).toBe(false);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should reject patient history with 0 notes via generateSummary', async () => {
    await fc.assert(
      fc.asyncProperty(emptyHistoryArb, async (historyData) => {
        // Mock prisma to return a patient with no notes
        mockPrisma.patient.findUnique.mockResolvedValue({
          id: historyData.patientId,
          fullName: historyData.patientName,
          allergies: [],
          clinicalNotes: [],
          prescriptions: [],
        });

        await expect(
          service.generateSummary(historyData.patientId),
        ).rejects.toThrow(BadRequestException);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should preserve exact count of diagnoses, treatments, and allergies from input', async () => {
    await fc.assert(
      fc.asyncProperty(patientHistoryArb, async (historyData) => {
        const summary = service.buildSummary(historyData);

        // Count must match input exactly
        expect(summary.sections.diagnosticos.length).toBe(historyData.diagnosticos.length);
        expect(summary.sections.tratamientos.length).toBe(historyData.tratamientos.length);
        expect(summary.sections.alergias.length).toBe(historyData.alergias.length);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
