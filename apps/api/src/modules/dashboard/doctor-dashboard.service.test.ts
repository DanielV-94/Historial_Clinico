import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DoctorDashboardService } from './doctor-dashboard.service';
import { PrismaService } from '../../database/prisma.service';

describe('DoctorDashboardService', () => {
  let service: DoctorDashboardService;
  let prisma: {
    appointment: {
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
    clinicalNote: {
      findFirst: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    prisma = {
      appointment: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      clinicalNote: {
        findFirst: vi.fn(),
      },
    };
    service = new DoctorDashboardService(prisma as unknown as PrismaService);
  });

  describe('getTodayAppointments', () => {
    it('should return empty list when no appointments exist for today', async () => {
      prisma.appointment.findMany.mockResolvedValue([]);

      const result = await service.getTodayAppointments('doctor-id');

      expect(result.appointments).toEqual([]);
      expect(result.allCompleted).toBe(false);
    });

    it('should return appointments ordered by time ASC with patient info', async () => {
      const mockAppointments = [
        {
          id: 'apt-1',
          appointmentTime: new Date('2024-01-15T09:00:00'),
          reason: 'Consulta general',
          status: 'scheduled',
          patient: { id: 'p-1', fullName: 'Juan Pérez' },
        },
        {
          id: 'apt-2',
          appointmentTime: new Date('2024-01-15T10:30:00'),
          reason: 'Seguimiento',
          status: 'scheduled',
          patient: { id: 'p-2', fullName: 'María López' },
        },
      ];
      prisma.appointment.findMany.mockResolvedValue(mockAppointments);

      const result = await service.getTodayAppointments('doctor-id');

      expect(result.appointments).toHaveLength(2);
      expect(result.appointments[0].patient.fullName).toBe('Juan Pérez');
      expect(result.appointments[1].patient.fullName).toBe('María López');
      expect(result.allCompleted).toBe(false);
    });

    it('should set allCompleted to true when all appointments are completed or cancelled', async () => {
      const mockAppointments = [
        {
          id: 'apt-1',
          appointmentTime: new Date('2024-01-15T09:00:00'),
          reason: 'Consulta',
          status: 'completed',
          patient: { id: 'p-1', fullName: 'Juan Pérez' },
        },
        {
          id: 'apt-2',
          appointmentTime: new Date('2024-01-15T10:30:00'),
          reason: 'Seguimiento',
          status: 'cancelled',
          patient: { id: 'p-2', fullName: 'María López' },
        },
      ];
      prisma.appointment.findMany.mockResolvedValue(mockAppointments);

      const result = await service.getTodayAppointments('doctor-id');

      expect(result.allCompleted).toBe(true);
    });

    it('should query appointments filtered by doctorId and today date', async () => {
      prisma.appointment.findMany.mockResolvedValue([]);

      await service.getTodayAppointments('doctor-123');

      expect(prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            doctorId: 'doctor-123',
          }),
          orderBy: { appointmentTime: 'asc' },
        }),
      );
    });
  });

  describe('getNextPatient', () => {
    it('should return null when no upcoming appointments exist', async () => {
      prisma.appointment.findFirst.mockResolvedValue(null);

      const result = await service.getNextPatient('doctor-id');

      expect(result).toBeNull();
    });

    it('should return next patient card with all required fields', async () => {
      prisma.appointment.findFirst.mockResolvedValue({
        reason: 'Botox aplicación',
        patient: {
          id: 'patient-1',
          fullName: 'Ana García',
          profilePhotoPath: '/uploads/profile/ana.jpg',
          allergies: [
            { description: 'Penicilina' },
            { description: 'Látex' },
          ],
        },
      });

      prisma.clinicalNote.findFirst.mockResolvedValue({
        content: 'Aplicación de ácido hialurónico en labios',
        createdAt: new Date('2024-01-10T14:00:00'),
      });

      const result = await service.getNextPatient('doctor-id');

      expect(result).not.toBeNull();
      expect(result!.fullName).toBe('Ana García');
      expect(result!.profilePhotoPath).toBe('/uploads/profile/ana.jpg');
      expect(result!.appointmentReason).toBe('Botox aplicación');
      expect(result!.allergies).toEqual(['Penicilina', 'Látex']);
      expect(result!.lastProcedure).toEqual({
        content: 'Aplicación de ácido hialurónico en labios',
        date: new Date('2024-01-10T14:00:00'),
      });
    });

    it('should return null lastProcedure when patient has no clinical notes', async () => {
      prisma.appointment.findFirst.mockResolvedValue({
        reason: 'Primera consulta',
        patient: {
          id: 'patient-2',
          fullName: 'Carlos Ruiz',
          profilePhotoPath: null,
          allergies: [],
        },
      });

      prisma.clinicalNote.findFirst.mockResolvedValue(null);

      const result = await service.getNextPatient('doctor-id');

      expect(result).not.toBeNull();
      expect(result!.fullName).toBe('Carlos Ruiz');
      expect(result!.profilePhotoPath).toBeNull();
      expect(result!.lastProcedure).toBeNull();
      expect(result!.allergies).toEqual([]);
    });

    it('should only find scheduled or in_progress appointments', async () => {
      prisma.appointment.findFirst.mockResolvedValue(null);

      await service.getNextPatient('doctor-id');

      expect(prisma.appointment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['scheduled', 'in_progress'] },
          }),
        }),
      );
    });
  });
});
