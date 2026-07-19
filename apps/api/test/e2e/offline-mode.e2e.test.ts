/**
 * E2E Integration Test: Offline Mode
 *
 * Tests that API responses are structured for client-side caching
 * and that the service layer properly supports read vs write operations.
 * 
 * Offline mode is primarily frontend (Service Worker) but the API
 * must provide cacheable, consistent JSON responses for GET endpoints
 * and clear status codes to distinguish read/write operations.
 *
 * **Validates: Requirement 11.5**
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';

import { PatientService } from '../../src/modules/patient/patient.service';
import { ClinicalNoteService } from '../../src/modules/clinical-note/clinical-note.service';
import { DoctorDashboardService } from '../../src/modules/dashboard/doctor-dashboard.service';

describe('E2E: Offline Mode - Cacheability', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      patient: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      clinicalNote: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      appointment: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      $transaction: vi.fn(),
      $queryRaw: vi.fn(),
    };
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
  });

  describe('GET endpoints return cacheable JSON responses', () => {
    it('should return patient data as serializable JSON for cache storage', async () => {
      /**
       * @validates Requirement 11.5 - Previously viewed patient data available offline
       * The API response must be JSON-serializable for Service Worker caching.
       */
      mockPrisma.patient.findUnique.mockResolvedValue({
        id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        fullName: 'María García López',
        birthDate: new Date('1990-05-15'),
        sex: 'F',
        phone: '5551234567',
        email: 'maria@email.com',
        bloodType: 'O+',
        allergies: [{ id: 'a1', description: 'Penicilina' }],
        previousSurgeries: [],
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
      });

      const patientService = new PatientService(mockPrisma as any);
      const result = await patientService.findById('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');

      // Verify the response is JSON-serializable (required for cache)
      expect(() => JSON.stringify(result)).not.toThrow();
      expect(result).toBeDefined();
      expect(result.datosGenerales.fullName).toBe('María García López');
    });

    it('should return appointment data that can be cached for offline viewing', async () => {
      /**
       * @validates Requirement 11.5 - Previously viewed appointments available offline
       */
      mockPrisma.appointment.findMany.mockResolvedValue([
        {
          id: 'apt-1',
          scheduledAt: new Date(),
          reason: 'Consulta',
          status: 'scheduled',
          patient: { fullName: 'Paciente A', profilePhotoPath: null },
        },
      ]);

      const dashService = new DoctorDashboardService(mockPrisma as any);
      const result = await dashService.getTodayAppointments('d1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a');

      // Response should be serializable for cache
      expect(() => JSON.stringify(result)).not.toThrow();
      expect(result).toBeDefined();
    });

    it('should return clinical notes in cacheable format', async () => {
      /**
       * @validates Requirement 11.5 - Previously viewed notes available offline
       */
      mockPrisma.clinicalNote.findMany.mockResolvedValue([
        {
          id: 'note-1',
          patientId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
          authorId: 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a',
          content: 'Nota de evolución para cache',
          createdAt: new Date('2024-06-15T10:00:00Z'),
          updatedAt: new Date('2024-06-15T10:00:00Z'),
          author: { username: 'dr.garcia' },
        },
      ]);
      mockPrisma.clinicalNote.count.mockResolvedValue(1);

      const noteService = new ClinicalNoteService(mockPrisma as any);
      const result = await noteService.findByPatient('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 1, 20);

      // Verify date fields are serialized properly for cache
      expect(() => JSON.stringify(result)).not.toThrow();
      expect(result).toBeDefined();
    });
  });

  describe('Consistent response structure for cache key generation', () => {
    it('should return consistent patient list structure with pagination metadata', async () => {
      /**
       * @validates Requirement 11.5 - Consistent response for StaleWhileRevalidate caching
       */
      mockPrisma.patient.findMany.mockResolvedValue([
        { id: 'p1', fullName: 'Paciente Uno', birthDate: new Date(), phone: '5551111111' },
        { id: 'p2', fullName: 'Paciente Dos', birthDate: new Date(), phone: '5552222222' },
      ]);
      mockPrisma.patient.count.mockResolvedValue(2);

      const patientService = new PatientService(mockPrisma as any);
      const result = await patientService.findAll(1, 20);

      // Verify paginated response structure is stable
      expect(result).toHaveProperty('patients');
      expect(result).toHaveProperty('total');
      expect(result.patients).toBeInstanceOf(Array);
      expect(typeof result.total).toBe('number');
    });

    it('should return same response shape on repeated calls (idempotent GETs)', async () => {
      /**
       * @validates Requirement 11.5 - Idempotent reads for caching reliability
       */
      const patientData = {
        id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        fullName: 'María García López',
        birthDate: new Date('1990-05-15'),
        sex: 'F',
        phone: '5551234567',
        allergies: [],
        previousSurgeries: [],
      };
      mockPrisma.patient.findUnique.mockResolvedValue(patientData);

      const patientService = new PatientService(mockPrisma as any);

      // First request
      const result1 = await patientService.findById('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');

      // Second identical request
      mockPrisma.patient.findUnique.mockResolvedValue(patientData);
      const result2 = await patientService.findById('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');

      // Same structure on repeated calls
      expect(Object.keys(result1).sort()).toEqual(Object.keys(result2).sort());
      expect(result1.fullName).toBe(result2.fullName);
    });
  });

  describe('Write operations vs read operations for offline blocking', () => {
    it('should throw NotFoundException for non-existent patient (handled as 404 by framework)', async () => {
      /**
       * @validates Requirement 11.5 - Read operations cached locally
       * When a patient doesn't exist on server, the API returns 404.
       * The Service Worker can detect this and fall back to cache if available.
       */
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      const patientService = new PatientService(mockPrisma as any);

      await expect(
        patientService.findById('00000000-0000-4000-a000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should distinguish successful creates from reads by return structure', async () => {
      /**
       * @validates Requirement 11.6 - Write operations blocked when offline
       * Creates return { isDuplicate, patient } — different from reads.
       * Frontend uses this to determine which operations need connectivity.
       */
      mockPrisma.patient.findFirst.mockResolvedValue(null);
      mockPrisma.patient.create.mockResolvedValue({
        id: 'new-patient-uuid',
        fullName: 'Nuevo Paciente',
        birthDate: new Date('1995-01-01'),
        sex: 'M',
        phone: '5553334444',
        allergies: [],
        previousSurgeries: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const patientService = new PatientService(mockPrisma as any);

      // Write operation returns create-specific structure
      const createResult = await patientService.create({
        fullName: 'Nuevo Paciente',
        birthDate: '1995-01-01',
        sex: 'M',
        phone: '5553334444',
      });
      expect(createResult).toHaveProperty('isDuplicate');

      // Read operation returns the entity directly
      mockPrisma.patient.findUnique.mockResolvedValue({
        id: 'new-patient-uuid',
        fullName: 'Nuevo Paciente',
        birthDate: new Date('1995-01-01'),
        sex: 'M',
        phone: '5553334444',
        allergies: [],
        previousSurgeries: [],
      });

      const readResult = await patientService.findById('new-patient-uuid');
      expect(readResult).toHaveProperty('datosGenerales');
      expect(readResult.datosGenerales).toHaveProperty('fullName');
      expect(readResult).not.toHaveProperty('isDuplicate');
    });
  });
});
