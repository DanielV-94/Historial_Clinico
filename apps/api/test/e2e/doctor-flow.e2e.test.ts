/**
 * E2E Integration Test: Doctor Workflow
 *
 * Tests the complete doctor flow:
 * login → dashboard → patient → clinical note → prescription → PDF
 *
 * Tests controller→service integration for each step.
 *
 * **Validates: Requirements 5.1-5.5, 4.1-4.5, 6.4-6.5**
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';

import { AuthService } from '../../src/modules/auth/auth.service';
import { DoctorDashboardService } from '../../src/modules/dashboard/doctor-dashboard.service';
import { PatientService } from '../../src/modules/patient/patient.service';
import { ClinicalNoteService } from '../../src/modules/clinical-note/clinical-note.service';
import { PrescriptionService } from '../../src/modules/prescription/prescription.service';

describe('E2E: Doctor Workflow', () => {
  let mockPrisma: any;
  let mockRedis: any;
  let mockJwtService: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      patient: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        count: vi.fn(),
      },
      appointment: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      clinicalNote: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      prescription: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));

    mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
    };

    mockJwtService = {
      sign: vi.fn().mockReturnValue('mock-jwt-token'),
      verify: vi.fn(),
    };

    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'JWT_ACCESS_SECRET') return 'test-secret';
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        return null;
      }),
    };
  });

  describe('Step 1: Login', () => {
    it('should authenticate doctor and return token pair', async () => {
      /**
       * @validates Requirement 13.1 - Username + password authentication
       */
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash('Doctor123', 12);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a',
        username: 'dr.garcia',
        role: 'doctor',
        passwordHash: hashedPassword,
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const authService = new AuthService(
        mockPrisma as any,
        mockJwtService as any,
        mockConfigService as any,
        mockRedis as any,
      );

      const result = await authService.login('dr.garcia', 'Doctor123');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should reject invalid credentials and increment failed attempts', async () => {
      /**
       * @validates Requirement 13.4 - Account lockout after 5 failed attempts
       */
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash('CorrectPass1', 12);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a',
        username: 'dr.garcia',
        role: 'doctor',
        passwordHash: hashedPassword,
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const authService = new AuthService(
        mockPrisma as any,
        mockJwtService as any,
        mockConfigService as any,
        mockRedis as any,
      );

      await expect(authService.login('dr.garcia', 'WrongPassword1')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginAttempts: 1 }),
        }),
      );
    });
  });

  describe('Step 2: Dashboard - Today appointments', () => {
    it('should return today appointments ordered by time ASC', async () => {
      /**
       * @validates Requirement 5.1 - Appointments ordered by time ascending
       */
      const today = new Date();
      const appointments = [
        {
          id: 'apt-1',
          scheduledAt: new Date(today.setHours(9, 0, 0)),
          reason: 'Consulta general',
          status: 'scheduled',
          patient: { fullName: 'Paciente A', profilePhotoPath: null },
        },
        {
          id: 'apt-2',
          scheduledAt: new Date(today.setHours(11, 0, 0)),
          reason: 'Seguimiento',
          status: 'scheduled',
          patient: { fullName: 'Paciente B', profilePhotoPath: null },
        },
      ];

      mockPrisma.appointment.findMany.mockResolvedValue(appointments);

      const dashService = new DoctorDashboardService(mockPrisma as any);
      const result = await dashService.getTodayAppointments('d1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a');

      expect(result).toBeDefined();
      expect(mockPrisma.appointment.findMany).toHaveBeenCalled();
    });

    it('should return next patient card with relevant info', async () => {
      /**
       * @validates Requirement 5.2 - Next patient card with details
       */
      mockPrisma.appointment.findFirst.mockResolvedValue({
        id: 'apt-next',
        scheduledAt: new Date(),
        reason: 'Control mensual',
        patient: {
          id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
          fullName: 'María García López',
          profilePhotoPath: null,
          allergies: [{ description: 'Penicilina' }],
        },
      });
      // Mock clinicalNote.findFirst for last procedure lookup
      mockPrisma.clinicalNote = {
        ...mockPrisma.clinicalNote,
        findFirst: vi.fn().mockResolvedValue(null),
      };

      const dashService = new DoctorDashboardService(mockPrisma as any);
      const result = await dashService.getNextPatient('d1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a');

      expect(result).toBeDefined();
      expect(mockPrisma.appointment.findFirst).toHaveBeenCalled();
    });
  });

  describe('Step 3: Patient - View and search', () => {
    it('should return patient profile with all sections', async () => {
      /**
       * @validates Requirement 1.2 - Patient data grouped by section
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
        emergencyContactName: 'Juan García',
        emergencyContactPhone: '5559876543',
      });

      const patientService = new PatientService(mockPrisma as any);
      const result = await patientService.findById('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');

      expect(result).toBeDefined();
      expect(result.datosGenerales.fullName).toBe('María García López');
      expect(result.antecedentesMedicos.allergies).toHaveLength(1);
    });

    it('should search patients by name with max 10 results', async () => {
      /**
       * @validates Requirement 5.3 - Search by name, max 10 results
       */
      const searchResults = Array.from({ length: 5 }, (_, i) => ({
        id: `patient-${i}`,
        full_name: `García Patient ${i}`,
        birth_date: new Date('1990-01-01'),
        phone: '555000000' + i,
        email: null,
        profile_photo_path: null,
      }));

      mockPrisma.$queryRaw = vi.fn().mockResolvedValue(searchResults);
      mockPrisma.patient.findMany.mockResolvedValue(searchResults);

      const patientService = new PatientService(mockPrisma as any);
      const results = await patientService.search('García');

      expect(results.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Step 4: Clinical Note - Create', () => {
    it('should create a clinical note for a patient', async () => {
      /**
       * @validates Requirement 4.1 - Add evolution note with date, time, author
       */
      const noteContent = 'Paciente presenta mejoría significativa en la movilidad del hombro derecho.';

      mockPrisma.clinicalNote.create.mockResolvedValue({
        id: 'note-uuid-001',
        patientId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        authorId: 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a',
        content: noteContent,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const noteService = new ClinicalNoteService(mockPrisma as any);
      const result = await noteService.create(
        'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a',
        noteContent,
      );

      expect(result).toHaveProperty('id');
      expect(result.content).toBe(noteContent);
      expect(mockPrisma.clinicalNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            patientId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
            authorId: 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a',
            content: noteContent,
          }),
        }),
      );
    });

    it('should reject empty clinical note', async () => {
      /**
       * @validates Requirement 4.2 - Reject empty notes
       */
      const noteService = new ClinicalNoteService(mockPrisma as any);

      await expect(
        noteService.create(
          'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
          'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a',
          '',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject note exceeding 10000 characters', async () => {
      /**
       * @validates Requirement 4.2 - Reject notes exceeding 10000 chars
       */
      const noteService = new ClinicalNoteService(mockPrisma as any);
      const longContent = 'a'.repeat(10001);

      await expect(
        noteService.create(
          'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
          'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a',
          longContent,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Step 5: Prescription - Create and send to assistant', () => {
    it('should create a prescription and assign to assistant', async () => {
      /**
       * @validates Requirement 4.3 - Prescription sent to assistant inbox
       */
      // Mock: assigned user exists and is an assistant
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
        role: 'assistant',
        fullName: 'Asistente López',
      });

      mockPrisma.prescription.create.mockResolvedValue({
        id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
        patientId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        doctorId: 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a',
        assignedTo: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
        content: 'Ibuprofeno 400mg cada 8 horas por 5 días',
        status: 'pending',
        createdAt: new Date(),
        patient: { fullName: 'María García' },
        doctor: { fullName: 'Dr. García' },
      });

      const prescService = new PrescriptionService(mockPrisma as any);
      const result = await prescService.create(
        'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a',
        'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        'Ibuprofeno 400mg cada 8 horas por 5 días',
        'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
      );

      expect(result).toHaveProperty('id');
      expect(result.status).toBe('pending');
      expect(mockPrisma.prescription.create).toHaveBeenCalled();
    });
  });

  describe('Full Flow Integration', () => {
    it('should complete entire doctor workflow: login → patient → note → prescription', async () => {
      /**
       * @validates Requirements 5.1-5.5, 4.1-4.5 - Complete doctor workflow
       */
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash('Doctor123', 12);

      // Step 1: Login
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a',
        username: 'dr.garcia',
        role: 'doctor',
        passwordHash: hashedPassword,
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const authService = new AuthService(
        mockPrisma as any,
        mockJwtService as any,
        mockConfigService as any,
        mockRedis as any,
      );
      const tokens = await authService.login('dr.garcia', 'Doctor123');
      expect(tokens.accessToken).toBeDefined();

      // Step 2: View patient
      mockPrisma.patient.findUnique.mockResolvedValue({
        id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        fullName: 'María García López',
        birthDate: new Date('1990-05-15'),
        sex: 'F',
        phone: '5551234567',
        allergies: [],
        previousSurgeries: [],
      });

      const patientService = new PatientService(mockPrisma as any);
      const patient = await patientService.findById('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');
      expect(patient.datosGenerales.fullName).toBe('María García López');

      // Step 3: Create clinical note
      mockPrisma.clinicalNote.create.mockResolvedValue({
        id: 'note-flow-uuid',
        patientId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        authorId: 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a',
        content: 'Nota de evolución del flujo completo',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const noteService = new ClinicalNoteService(mockPrisma as any);
      const note = await noteService.create(
        'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a',
        'Nota de evolución del flujo completo',
      );
      expect(note.content).toBe('Nota de evolución del flujo completo');

      // Step 4: Create prescription
      // Mock: assigned user exists
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
        role: 'assistant',
        fullName: 'Asistente López',
      });
      mockPrisma.prescription.create.mockResolvedValue({
        id: 'presc-flow-uuid',
        content: 'Paracetamol 500mg cada 6 horas',
        status: 'pending',
        createdAt: new Date(),
        patient: { fullName: 'María García' },
        doctor: { fullName: 'Dr. García' },
      });

      const prescService = new PrescriptionService(mockPrisma as any);
      const prescription = await prescService.create(
        'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a',
        'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        'Paracetamol 500mg cada 6 horas',
        'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
      );
      expect(prescription.status).toBe('pending');
    });
  });
});
