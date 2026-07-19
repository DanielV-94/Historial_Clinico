import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AssistantDashboardService } from './assistant-dashboard.service';
import { PrismaService } from '../../database/prisma.service';

describe('AssistantDashboardService', () => {
  let service: AssistantDashboardService;
  let prisma: {
    appointment: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    prisma = {
      appointment: {
        findMany: vi.fn(),
      },
    };
    service = new AssistantDashboardService(prisma as unknown as PrismaService);
  });

  describe('getTodayAppointments', () => {
    it('should return empty list when no appointments exist for today', async () => {
      prisma.appointment.findMany.mockResolvedValue([]);

      const result = await service.getTodayAppointments();

      expect(result.appointments).toEqual([]);
    });

    it('should return appointments ordered by time ASC with patient info and materials', async () => {
      const mockAppointments = [
        {
          id: 'apt-1',
          appointmentTime: new Date('2024-01-15T09:00:00'),
          reason: 'Consulta general',
          status: 'scheduled',
          patient: { id: 'p-1', fullName: 'Juan Pérez' },
          materials: [
            { id: 'mat-1', materialName: 'Guantes estériles', quantity: 2, notes: null },
            { id: 'mat-2', materialName: 'Ácido hialurónico', quantity: 1, notes: 'Marca Juvederm' },
          ],
        },
        {
          id: 'apt-2',
          appointmentTime: new Date('2024-01-15T10:30:00'),
          reason: 'Seguimiento',
          status: 'scheduled',
          patient: { id: 'p-2', fullName: 'María López' },
          materials: [],
        },
      ];
      prisma.appointment.findMany.mockResolvedValue(mockAppointments);

      const result = await service.getTodayAppointments();

      expect(result.appointments).toHaveLength(2);
      expect(result.appointments[0].patient.fullName).toBe('Juan Pérez');
      expect(result.appointments[0].materials).toHaveLength(2);
      expect(result.appointments[0].materials[0].materialName).toBe('Guantes estériles');
      expect(result.appointments[0].materials[1].notes).toBe('Marca Juvederm');
      expect(result.appointments[1].patient.fullName).toBe('María López');
      expect(result.appointments[1].materials).toHaveLength(0);
    });

    it('should query ALL appointments for today without filtering by specific assistant', async () => {
      prisma.appointment.findMany.mockResolvedValue([]);

      await service.getTodayAppointments();

      const callArgs = prisma.appointment.findMany.mock.calls[0][0];
      // Should NOT have an assignedTo or assistantId filter
      expect(callArgs.where).not.toHaveProperty('assignedTo');
      expect(callArgs.where).not.toHaveProperty('assistantId');
      // Should have appointmentDate filter for today
      expect(callArgs.where).toHaveProperty('appointmentDate');
      // Should order by time ASC
      expect(callArgs.orderBy).toEqual({ appointmentTime: 'asc' });
    });

    it('should include materials in the select query', async () => {
      prisma.appointment.findMany.mockResolvedValue([]);

      await service.getTodayAppointments();

      const callArgs = prisma.appointment.findMany.mock.calls[0][0];
      expect(callArgs.select.materials).toBeDefined();
      expect(callArgs.select.materials.select).toEqual({
        id: true,
        materialName: true,
        quantity: true,
        notes: true,
      });
    });

    it('should return appointments with materials containing all expected fields', async () => {
      const mockAppointments = [
        {
          id: 'apt-1',
          appointmentTime: new Date('2024-01-15T08:00:00'),
          reason: 'Botox',
          status: 'scheduled',
          patient: { id: 'p-1', fullName: 'Laura Sánchez' },
          materials: [
            { id: 'mat-1', materialName: 'Botox 100u', quantity: 1, notes: 'Almacenado en frío' },
          ],
        },
      ];
      prisma.appointment.findMany.mockResolvedValue(mockAppointments);

      const result = await service.getTodayAppointments();

      const material = result.appointments[0].materials[0];
      expect(material).toHaveProperty('id');
      expect(material).toHaveProperty('materialName');
      expect(material).toHaveProperty('quantity');
      expect(material).toHaveProperty('notes');
    });
  });
});
