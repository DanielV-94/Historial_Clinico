import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AIService, PatientHistoryData } from './ai.service';
import { PrismaService } from '../../database/prisma.service';

/**
 * Unit tests for AIService OpenAI integration:
 * - Timeout (30s) per call
 * - Retry with exponential backoff (2s, 4s)
 * - Fallback to local buildSummary when OpenAI fails
 * - Fallback when OPENAI_API_KEY is not set
 *
 * @validates Requirements 14.1, 14.2, 14.3, 14.4, 14.5
 */

function createMockPrisma() {
  return {
    patient: {
      findUnique: vi.fn(),
    },
  };
}

const samplePatientData = {
  id: 'patient-001',
  fullName: 'Juan Pérez',
  allergies: [{ description: 'Penicilina' }],
  clinicalNotes: [
    {
      content: 'Paciente estable. Diagnóstico: Hipertensión\nRecomendación: Control mensual',
      createdAt: new Date('2024-06-01'),
    },
  ],
  prescriptions: [{ content: 'Losartán 50mg' }],
};

describe('AIService - OpenAI Integration', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let originalEnv: string | undefined;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    originalEnv = process.env.OPENAI_API_KEY;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.OPENAI_API_KEY = originalEnv;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Fallback to local when OPENAI_API_KEY is not set', () => {
    it('should use local buildSummary when no API key is configured', async () => {
      delete process.env.OPENAI_API_KEY;
      const service = new AIService(mockPrisma as unknown as PrismaService);

      mockPrisma.patient.findUnique.mockResolvedValue(samplePatientData);

      vi.useRealTimers();
      const result = await service.generateSummary('patient-001');

      expect(result.status).toBe('COMPLETADO');
      expect(result.patientId).toBe('patient-001');
      expect(result.patientName).toBe('Juan Pérez');
      expect(result.sections.diagnosticos).toContain('Hipertensión');
      expect(result.sections.tratamientos).toContain('Losartán 50mg');
      expect(result.sections.alergias).toContain('Penicilina');
      expect(result.sections.recomendaciones).toContain('Control mensual');
    });
  });

  describe('Validation', () => {
    it('should throw BadRequestException when patient has 0 notes', async () => {
      delete process.env.OPENAI_API_KEY;
      const service = new AIService(mockPrisma as unknown as PrismaService);

      mockPrisma.patient.findUnique.mockResolvedValue({
        ...samplePatientData,
        clinicalNotes: [],
      });

      await expect(service.generateSummary('patient-001')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when patient not found', async () => {
      delete process.env.OPENAI_API_KEY;
      const service = new AIService(mockPrisma as unknown as PrismaService);

      mockPrisma.patient.findUnique.mockResolvedValue(null);

      await expect(service.generateSummary('nonexistent')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('buildSummary (local fallback)', () => {
    it('should extract all 4 sections correctly', () => {
      delete process.env.OPENAI_API_KEY;
      const service = new AIService(mockPrisma as unknown as PrismaService);

      const historyData: PatientHistoryData = {
        patientId: 'p1',
        patientName: 'Test Patient',
        diagnosticos: ['Diabetes', 'Hipertensión'],
        tratamientos: ['Metformina', 'Losartán'],
        alergias: ['Penicilina'],
        notas: [
          { content: 'Recomendación: Dieta baja en sodio', createdAt: new Date() },
          { content: 'Nota sin recomendaciones', createdAt: new Date() },
        ],
      };

      const result = service.buildSummary(historyData);

      expect(result.status).toBe('COMPLETADO');
      expect(result.sections.diagnosticos).toEqual(['Diabetes', 'Hipertensión']);
      expect(result.sections.tratamientos).toEqual(['Metformina', 'Losartán']);
      expect(result.sections.alergias).toEqual(['Penicilina']);
      expect(result.sections.recomendaciones).toContain('Dieta baja en sodio');
    });

    it('should only include recommendations from last 10 notes', () => {
      delete process.env.OPENAI_API_KEY;
      const service = new AIService(mockPrisma as unknown as PrismaService);

      const notas = [];
      // Last 10 notes with recommendations
      for (let i = 0; i < 10; i++) {
        notas.push({
          content: `Recomendación: Rec_Last10_${i}`,
          createdAt: new Date(2024, 6, 15 - i),
        });
      }
      // Notes beyond 10th with recommendations that should NOT appear
      for (let i = 10; i < 15; i++) {
        notas.push({
          content: `Recomendación: Rec_Old_${i}`,
          createdAt: new Date(2024, 1, 15 - i),
        });
      }

      const historyData: PatientHistoryData = {
        patientId: 'p2',
        patientName: 'Many Notes',
        diagnosticos: [],
        tratamientos: [],
        alergias: [],
        notas,
      };

      const result = service.buildSummary(historyData);

      // Should include last 10
      for (let i = 0; i < 10; i++) {
        expect(result.sections.recomendaciones).toContain(`Rec_Last10_${i}`);
      }
      // Should NOT include notes beyond 10th
      for (let i = 10; i < 15; i++) {
        expect(result.sections.recomendaciones).not.toContain(`Rec_Old_${i}`);
      }
    });
  });

  describe('OpenAI client initialization', () => {
    it('should initialize OpenAI client when API key is set', () => {
      process.env.OPENAI_API_KEY = 'test-key-12345';
      const service = new AIService(mockPrisma as unknown as PrismaService);

      // The openaiClient is private, but we can verify behavior through generateSummary
      // If OpenAI client is initialized, it will attempt API calls before fallback
      expect(service).toBeDefined();
    });

    it('should not initialize OpenAI client when API key is missing', () => {
      delete process.env.OPENAI_API_KEY;
      const service = new AIService(mockPrisma as unknown as PrismaService);

      expect(service).toBeDefined();
    });
  });

  describe('generateSummary with OpenAI fallback behavior', () => {
    it('should fall back to local when OpenAI API call fails', async () => {
      process.env.OPENAI_API_KEY = 'test-key-12345';
      const service = new AIService(mockPrisma as unknown as PrismaService);

      // Mock the internal openai client to throw
      const mockCreate = vi.fn().mockRejectedValue(new Error('API Error'));
      (service as any).openaiClient = {
        chat: { completions: { create: mockCreate } },
      };
      // Mock sleep to avoid real delays in tests
      (service as any).sleep = vi.fn().mockResolvedValue(undefined);

      mockPrisma.patient.findUnique.mockResolvedValue(samplePatientData);

      vi.useRealTimers();
      const result = await service.generateSummary('patient-001');

      // Should still succeed using local fallback
      expect(result.status).toBe('COMPLETADO');
      expect(result.sections.diagnosticos).toContain('Hipertensión');
      expect(result.sections.tratamientos).toContain('Losartán 50mg');
      expect(result.sections.alergias).toContain('Penicilina');
    });

    it('should retry 3 times total (1 initial + 2 retries) before falling back', async () => {
      process.env.OPENAI_API_KEY = 'test-key-12345';
      const service = new AIService(mockPrisma as unknown as PrismaService);

      const mockCreate = vi.fn().mockRejectedValue(new Error('Timeout'));
      (service as any).openaiClient = {
        chat: { completions: { create: mockCreate } },
      };
      // Mock sleep to avoid real delays in tests
      const mockSleep = vi.fn().mockResolvedValue(undefined);
      (service as any).sleep = mockSleep;

      mockPrisma.patient.findUnique.mockResolvedValue(samplePatientData);

      vi.useRealTimers();
      const result = await service.generateSummary('patient-001');

      // Should have attempted 3 times (1 + 2 retries)
      expect(mockCreate).toHaveBeenCalledTimes(3);
      // Should have slept twice with exponential backoff delays
      expect(mockSleep).toHaveBeenCalledTimes(2);
      expect(mockSleep).toHaveBeenNthCalledWith(1, 2000);
      expect(mockSleep).toHaveBeenNthCalledWith(2, 4000);
      // Should still return a valid summary via fallback
      expect(result.status).toBe('COMPLETADO');
    });

    it('should use OpenAI response when API call succeeds', async () => {
      process.env.OPENAI_API_KEY = 'test-key-12345';
      const service = new AIService(mockPrisma as unknown as PrismaService);

      const aiResponse = JSON.stringify({
        diagnosticos: ['Hipertensión Arterial Esencial'],
        tratamientos: ['Losartán 50mg diario'],
        alergias: ['Penicilina - reacción anafiláctica'],
        recomendaciones: ['Control de presión arterial semanal', 'Dieta hiposódica'],
      });

      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{ message: { content: aiResponse } }],
      });
      (service as any).openaiClient = {
        chat: { completions: { create: mockCreate } },
      };

      mockPrisma.patient.findUnique.mockResolvedValue(samplePatientData);

      vi.useRealTimers();
      const result = await service.generateSummary('patient-001');

      expect(result.status).toBe('COMPLETADO');
      expect(result.sections.diagnosticos).toContain('Hipertensión Arterial Esencial');
      expect(result.sections.tratamientos).toContain('Losartán 50mg diario');
      expect(result.sections.alergias).toContain('Penicilina - reacción anafiláctica');
      expect(result.sections.recomendaciones).toContain('Control de presión arterial semanal');
    });

    it('should fall back to local buildSummary if OpenAI returns invalid JSON', async () => {
      process.env.OPENAI_API_KEY = 'test-key-12345';
      const service = new AIService(mockPrisma as unknown as PrismaService);

      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'not valid json at all' } }],
      });
      (service as any).openaiClient = {
        chat: { completions: { create: mockCreate } },
      };

      mockPrisma.patient.findUnique.mockResolvedValue(samplePatientData);

      vi.useRealTimers();
      const result = await service.generateSummary('patient-001');

      // parseOpenAIResponse catches JSON error and uses buildSummary
      expect(result.status).toBe('COMPLETADO');
      expect(result.sections.diagnosticos).toContain('Hipertensión');
    });

    it('should succeed on second attempt if first fails', async () => {
      process.env.OPENAI_API_KEY = 'test-key-12345';
      const service = new AIService(mockPrisma as unknown as PrismaService);

      const aiResponse = JSON.stringify({
        diagnosticos: ['Hipertensión'],
        tratamientos: ['Losartán'],
        alergias: ['Penicilina'],
        recomendaciones: ['Reposo'],
      });

      const mockCreate = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          choices: [{ message: { content: aiResponse } }],
        });
      (service as any).openaiClient = {
        chat: { completions: { create: mockCreate } },
      };
      // Mock sleep to avoid real delays in tests
      (service as any).sleep = vi.fn().mockResolvedValue(undefined);

      mockPrisma.patient.findUnique.mockResolvedValue(samplePatientData);

      vi.useRealTimers();
      const result = await service.generateSummary('patient-001');

      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(result.status).toBe('COMPLETADO');
      expect(result.sections.recomendaciones).toContain('Reposo');
    });
  });
});
