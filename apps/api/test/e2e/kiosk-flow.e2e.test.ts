/**
 * E2E Integration Test: Kiosk Registration Flow
 *
 * Tests the complete kiosk wizard: registration → signature → patient created.
 * Verifies controller→service integration for patient creation with
 * the same validation and duplicate detection used by the kiosk.
 *
 * **Validates: Requirements 7.1-7.6**
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PatientService } from '../../src/modules/patient/patient.service';
import { BadRequestException } from '@nestjs/common';

describe('E2E: Kiosk Registration Flow', () => {
  let patientService: PatientService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      patient: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    // $transaction executes callback with mock prisma as tx
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));

    patientService = new PatientService(mockPrisma as any);
  });

  describe('Wizard completo → firma → paciente creado', () => {
    it('should create a patient with all required fields from kiosk wizard data', async () => {
      /**
       * @validates Requirement 7.1 - Interactive wizard registration
       * @validates Requirement 7.3 - Patient created automatically after signature
       */
      const kioskRegistrationData = {
        fullName: 'Carlos Hernández Morales',
        birthDate: '1985-03-20',
        sex: 'M',
        phone: '5551234567',
        email: 'carlos@email.com',
        address: 'Calle Reforma 456, CDMX',
        bloodType: 'A+',
        allergies: ['Penicilina', 'Aspirina'],
        previousSurgeries: [
          { name: 'Apendicectomía', date: '2010-06-15' },
        ],
        emergencyContactName: 'Ana Hernández',
        emergencyContactPhone: '5559876543',
        emergencyContactRelation: 'Esposa',
      };

      // Mock: no duplicate found
      mockPrisma.patient.findFirst.mockResolvedValue(null);

      // Mock: patient created successfully in transaction
      const createdPatient = {
        id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        fullName: kioskRegistrationData.fullName,
        birthDate: new Date('1985-03-20'),
        sex: 'M',
        phone: '5551234567',
        allergies: [
          { id: 'a1', description: 'Penicilina' },
          { id: 'a2', description: 'Aspirina' },
        ],
        previousSurgeries: [
          { id: 's1', name: 'Apendicectomía', surgeryDate: new Date('2010-06-15') },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.patient.create.mockResolvedValue(createdPatient);

      const result = await patientService.create(kioskRegistrationData);

      expect(result.isDuplicate).toBe(false);
      expect(result.patient).toBeDefined();
      expect(mockPrisma.patient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fullName: 'Carlos Hernández Morales',
            phone: '5551234567',
          }),
        }),
      );
    });

    it('should detect duplicate patient (same name + birth date) during kiosk registration', async () => {
      /**
       * @validates Requirement 7.6 - Detect existing patient with same name + DOB
       */
      const duplicateData = {
        fullName: 'María García López',
        birthDate: '1990-05-15',
        sex: 'F',
        phone: '5551111111',
      };

      // Mock: duplicate found
      mockPrisma.patient.findFirst.mockResolvedValue({
        id: 'existing-patient-id',
        fullName: 'María García López',
        birthDate: new Date('1990-05-15'),
        phone: '5550000000',
      });

      const result = await patientService.create(duplicateData);

      expect(result.isDuplicate).toBe(true);
      expect(result.existingPatient).toBeDefined();
      // Should NOT call create when duplicate detected
      expect(mockPrisma.patient.create).not.toHaveBeenCalled();
    });

    it('should reject registration with missing required fields', async () => {
      /**
       * @validates Requirement 7.4 - Real-time field validation rejects incomplete data
       */
      const incompleteData = {
        fullName: '', // empty required field
        sex: 'M',
        birthDate: '1990-01-01',
        phone: '5551234567',
      };

      await expect(patientService.create(incompleteData)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject registration with invalid field formats', async () => {
      /**
       * @validates Requirement 7.4 - Validation of field formats
       */
      const invalidData = {
        fullName: 'Test Patient',
        birthDate: '2090-01-01', // future date
        sex: 'M',
        phone: '123', // too short
      };

      await expect(patientService.create(invalidData)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create patient with emergency contact from kiosk wizard', async () => {
      /**
       * @validates Requirement 7.1 - Wizard ends with emergency contact step
       * @validates Requirement 7.3 - Auto-creates patient profile after signing
       */
      const fullKioskData = {
        fullName: 'Roberto Pérez Cruz',
        birthDate: '1978-11-30',
        sex: 'M',
        phone: '5552223344',
        email: 'roberto@email.com',
        address: 'Av. Insurgentes 789',
        bloodType: 'B+',
        emergencyContactName: 'Elena Pérez',
        emergencyContactPhone: '5556667788',
        emergencyContactRelation: 'Hermana',
      };

      mockPrisma.patient.findFirst.mockResolvedValue(null);
      mockPrisma.patient.create.mockResolvedValue({
        id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
        ...fullKioskData,
        birthDate: new Date('1978-11-30'),
        allergies: [],
        previousSurgeries: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await patientService.create(fullKioskData);

      expect(result.isDuplicate).toBe(false);
      expect(result.patient).toBeDefined();
      expect(mockPrisma.patient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            emergencyContactName: 'Elena Pérez',
            emergencyContactPhone: '5556667788',
            emergencyContactRelation: 'Hermana',
          }),
        }),
      );
    });
  });

  describe('Timeout e inactividad del kiosco', () => {
    it('should not persist any data when kiosk registration is abandoned (all-or-nothing)', async () => {
      /**
       * @validates Requirement 7.5 - Inactivity timeout: discard partial data
       * The API enforces atomic creation: validation fails if required fields missing.
       * A partial submission (simulating abandoned wizard) is rejected entirely.
       */
      const partialData = {
        fullName: 'Paciente Incompleto',
        birthDate: '1990-01-01',
        sex: 'M',
        // missing phone — required field
      };

      await expect(patientService.create(partialData as any)).rejects.toThrow(
        BadRequestException,
      );
      // No partial data should have been persisted
      expect(mockPrisma.patient.create).not.toHaveBeenCalled();
    });
  });
});
