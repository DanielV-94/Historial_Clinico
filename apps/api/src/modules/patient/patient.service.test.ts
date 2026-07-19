import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PatientService } from './patient.service';
import { PrismaService } from '../../database/prisma.service';

/**
 * Unit tests for PatientService.
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 5.3
 */

describe('PatientService', () => {
  let service: PatientService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      patient: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      allergy: {
        deleteMany: vi.fn(),
      },
      previousSurgery: {
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn((fn) => fn(prisma)),
      $queryRaw: vi.fn(),
    };
    service = new PatientService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    const validPatient = {
      fullName: 'Juan Pérez García',
      birthDate: new Date('1990-05-15'),
      sex: 'M' as const,
      phone: '5512345678',
      allergies: ['Penicilina'],
      previousSurgeries: [{ name: 'Apendicectomía', date: new Date('2015-03-20') }],
    };

    it('should validate input and reject invalid data', async () => {
      const invalidPatient = {
        fullName: '',
        birthDate: new Date('2090-01-01'),
        sex: 'X',
        phone: '123',
      };

      await expect(service.create(invalidPatient as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should detect duplicate and return existing patient', async () => {
      const existingPatient = {
        id: 'existing-uuid',
        fullName: 'Juan Pérez García',
        birthDate: new Date('1990-05-15'),
        phone: '5512345678',
      };
      prisma.patient.findFirst.mockResolvedValue(existingPatient);

      const result = await service.create(validPatient);

      expect(result.isDuplicate).toBe(true);
      expect(result.existingPatient).toEqual(existingPatient);
    });

    it('should create patient with allergies and surgeries when no duplicate', async () => {
      prisma.patient.findFirst.mockResolvedValue(null);
      const createdPatient = {
        id: 'new-uuid',
        ...validPatient,
        allergies: [{ id: 'a1', description: 'Penicilina', patientId: 'new-uuid' }],
        previousSurgeries: [{ id: 's1', name: 'Apendicectomía', surgeryDate: new Date('2015-03-20'), patientId: 'new-uuid' }],
      };
      prisma.patient.create.mockResolvedValue(createdPatient);

      const result = await service.create(validPatient);

      expect(result.isDuplicate).toBe(false);
      expect((result as any).patient.id).toBe('new-uuid');
      expect(prisma.patient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fullName: 'Juan Pérez García',
            allergies: { create: [{ description: 'Penicilina' }] },
          }),
          include: { allergies: true, previousSurgeries: true },
        }),
      );
    });

    it('should reject patient with more than 50 allergies', async () => {
      const tooManyAllergies = {
        ...validPatient,
        allergies: Array(51).fill('Alergia test'),
      };

      await expect(service.create(tooManyAllergies)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findById', () => {
    it('should return patient grouped by sections', async () => {
      const mockPatient = {
        id: 'patient-uuid',
        fullName: 'María López',
        birthDate: new Date('1985-08-20'),
        sex: 'F',
        phone: '5598765432',
        email: 'maria@example.com',
        address: 'Calle 123',
        bloodType: 'A_POS',
        profilePhotoPath: null,
        emergencyContactName: 'Pedro López',
        emergencyContactPhone: '5511111111',
        emergencyContactRelation: 'Esposo',
        insuranceProvider: 'GNP',
        insurancePolicyNumber: 'POL-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        allergies: [{ id: 'a1', description: 'Polen' }],
        previousSurgeries: [{ id: 's1', name: 'Cesárea', surgeryDate: new Date('2018-01-10') }],
      };
      prisma.patient.findUnique.mockResolvedValue(mockPatient);

      const result = await service.findById('patient-uuid');

      expect(result.datosGenerales.fullName).toBe('María López');
      expect(result.antecedentesMedicos.allergies).toHaveLength(1);
      expect(result.antecedentesMedicos.previousSurgeries).toHaveLength(1);
      expect(result.contactoEmergencia.name).toBe('Pedro López');
      expect(result.seguroMedico.provider).toBe('GNP');
    });

    it('should throw NotFoundException for non-existent patient', async () => {
      prisma.patient.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should validate partial input', async () => {
      const invalidUpdate = { phone: '123' };

      prisma.patient.findUnique.mockResolvedValue({ id: 'uuid' });

      await expect(service.update('uuid', invalidUpdate as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update patient data', async () => {
      prisma.patient.findUnique.mockResolvedValue({ id: 'uuid' });
      prisma.patient.update.mockResolvedValue({
        id: 'uuid',
        fullName: 'Updated Name',
        allergies: [],
        previousSurgeries: [],
      });

      const result = await service.update('uuid', { fullName: 'Updated Name' });

      expect(result.fullName).toBe('Updated Name');
    });

    it('should throw NotFoundException if patient does not exist', async () => {
      prisma.patient.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('search', () => {
    it('should return empty array for empty query', async () => {
      const result = await service.search('');
      expect(result).toEqual([]);
    });

    it('should return empty array for whitespace-only query', async () => {
      const result = await service.search('   ');
      expect(result).toEqual([]);
    });

    it('should call prisma raw query with trigram search', async () => {
      const mockResults = [
        {
          id: 'uuid-1',
          full_name: 'Juan Pérez',
          birth_date: new Date('1990-01-01'),
          phone: '5512345678',
          email: 'juan@test.com',
          profile_photo_path: null,
        },
      ];
      prisma.$queryRaw.mockResolvedValue(mockResults);

      const result = await service.search('Juan');

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual(mockResults);
    });
  });

  describe('checkDuplicate', () => {
    it('should detect duplicate with case-insensitive name matching', async () => {
      const existingPatient = {
        id: 'uuid-1',
        fullName: 'Juan Pérez',
        birthDate: new Date('1990-05-15'),
        phone: '5512345678',
      };
      prisma.patient.findFirst.mockResolvedValue(existingPatient);

      const result = await service.checkDuplicate(
        '  JUAN PÉREZ  ',
        new Date('1990-05-15'),
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.existingPatient).toEqual(existingPatient);
    });

    it('should not detect duplicate when name differs', async () => {
      prisma.patient.findFirst.mockResolvedValue(null);

      const result = await service.checkDuplicate(
        'Pedro García',
        new Date('1990-05-15'),
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.existingPatient).toBeUndefined();
    });

    it('should normalize name by trimming and lowercasing', async () => {
      prisma.patient.findFirst.mockResolvedValue(null);

      await service.checkDuplicate('  Test Name  ', new Date('1990-01-01'));

      expect(prisma.patient.findFirst).toHaveBeenCalledWith({
        where: {
          birthDate: new Date('1990-01-01'),
          fullName: {
            equals: 'test name',
            mode: 'insensitive',
          },
        },
        select: {
          id: true,
          fullName: true,
          birthDate: true,
          phone: true,
        },
      });
    });
  });
});
