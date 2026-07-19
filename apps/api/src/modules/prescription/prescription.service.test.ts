import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrescriptionService } from './prescription.service';

// Mock PrismaService
const mockPrismaService = {
  user: {
    findUnique: vi.fn(),
  },
  prescription: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
};

describe('PrescriptionService', () => {
  let service: PrescriptionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PrescriptionService(mockPrismaService as any);
  });

  describe('create', () => {
    it('should throw BadRequestException when content is empty', async () => {
      await expect(
        service.create('doctor-1', 'patient-1', '', 'assistant-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when content is whitespace only', async () => {
      await expect(
        service.create('doctor-1', 'patient-1', '   ', 'assistant-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when assignee does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create('doctor-1', 'patient-1', 'Take medicine', 'non-existent'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when assignee is not an assistant or admin', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'doctor-2',
        role: 'doctor',
        fullName: 'Dr. Other',
      });

      await expect(
        service.create('doctor-1', 'patient-1', 'Take medicine', 'doctor-2'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create prescription and emit SSE event when valid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'assistant-1',
        role: 'assistant',
        fullName: 'Assistant One',
      });

      const mockPrescription = {
        id: 'rx-1',
        doctorId: 'doctor-1',
        patientId: 'patient-1',
        content: 'Take medicine twice daily',
        assignedTo: 'assistant-1',
        status: 'pending',
        readAt: null,
        completedAt: null,
        createdAt: new Date(),
        patient: { fullName: 'Patient One' },
        doctor: { fullName: 'Dr. Smith' },
      };

      mockPrismaService.prescription.create.mockResolvedValue(mockPrescription);

      const result = await service.create(
        'doctor-1',
        'patient-1',
        'Take medicine twice daily',
        'assistant-1',
      );

      expect(result).toEqual(mockPrescription);
      expect(mockPrismaService.prescription.create).toHaveBeenCalledWith({
        data: {
          doctorId: 'doctor-1',
          patientId: 'patient-1',
          content: 'Take medicine twice daily',
          assignedTo: 'assistant-1',
          status: 'pending',
        },
        include: {
          patient: { select: { fullName: true } },
          doctor: { select: { fullName: true } },
        },
      });
    });
  });

  describe('getInbox', () => {
    it('should return paginated prescriptions ordered by createdAt DESC', async () => {
      const mockPrescriptions = [
        { id: 'rx-2', createdAt: new Date('2024-02-01'), status: 'pending' },
        { id: 'rx-1', createdAt: new Date('2024-01-01'), status: 'read' },
      ];

      mockPrismaService.prescription.findMany.mockResolvedValue(mockPrescriptions);
      mockPrismaService.prescription.count.mockResolvedValue(2);

      const result = await service.getInbox('assistant-1', 1, 20);

      expect(result.data).toEqual(mockPrescriptions);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      expect(mockPrismaService.prescription.findMany).toHaveBeenCalledWith({
        where: { assignedTo: 'assistant-1' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
        include: {
          patient: { select: { fullName: true } },
          doctor: { select: { fullName: true } },
        },
      });
    });

    it('should handle pagination correctly', async () => {
      mockPrismaService.prescription.findMany.mockResolvedValue([]);
      mockPrismaService.prescription.count.mockResolvedValue(25);

      const result = await service.getInbox('assistant-1', 2, 20);

      expect(result.meta.totalPages).toBe(2);
      expect(mockPrismaService.prescription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
    });
  });

  describe('markAsRead', () => {
    it('should throw NotFoundException when prescription does not exist', async () => {
      mockPrismaService.prescription.findUnique.mockResolvedValue(null);

      await expect(
        service.markAsRead('non-existent', 'assistant-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when assistant is not the assignee', async () => {
      mockPrismaService.prescription.findUnique.mockResolvedValue({
        id: 'rx-1',
        assignedTo: 'assistant-2',
        status: 'pending',
      });

      await expect(
        service.markAsRead('rx-1', 'assistant-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update status to read and set readAt', async () => {
      mockPrismaService.prescription.findUnique.mockResolvedValue({
        id: 'rx-1',
        assignedTo: 'assistant-1',
        status: 'pending',
      });

      const mockUpdated = {
        id: 'rx-1',
        status: 'read',
        readAt: new Date(),
        patient: { fullName: 'Patient' },
        doctor: { fullName: 'Doctor' },
      };
      mockPrismaService.prescription.update.mockResolvedValue(mockUpdated);

      const result = await service.markAsRead('rx-1', 'assistant-1');

      expect(result.status).toBe('read');
      expect(mockPrismaService.prescription.update).toHaveBeenCalledWith({
        where: { id: 'rx-1' },
        data: {
          status: 'read',
          readAt: expect.any(Date),
        },
        include: {
          patient: { select: { fullName: true } },
          doctor: { select: { fullName: true } },
        },
      });
    });

    it('should return current state without update if already read', async () => {
      const prescription = {
        id: 'rx-1',
        assignedTo: 'assistant-1',
        status: 'read',
        readAt: new Date(),
      };
      mockPrismaService.prescription.findUnique.mockResolvedValue(prescription);

      const result = await service.markAsRead('rx-1', 'assistant-1');

      expect(result).toEqual(prescription);
      expect(mockPrismaService.prescription.update).not.toHaveBeenCalled();
    });
  });

  describe('markAsCompleted', () => {
    it('should throw NotFoundException when prescription does not exist', async () => {
      mockPrismaService.prescription.findUnique.mockResolvedValue(null);

      await expect(
        service.markAsCompleted('non-existent', 'assistant-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when assistant is not the assignee', async () => {
      mockPrismaService.prescription.findUnique.mockResolvedValue({
        id: 'rx-1',
        assignedTo: 'assistant-2',
        status: 'read',
      });

      await expect(
        service.markAsCompleted('rx-1', 'assistant-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update status to completed and set completedAt and readAt', async () => {
      mockPrismaService.prescription.findUnique.mockResolvedValue({
        id: 'rx-1',
        assignedTo: 'assistant-1',
        status: 'read',
        readAt: new Date('2024-01-01'),
      });

      const mockUpdated = {
        id: 'rx-1',
        status: 'completed',
        completedAt: new Date(),
        readAt: new Date('2024-01-01'),
        patient: { fullName: 'Patient' },
        doctor: { fullName: 'Doctor' },
      };
      mockPrismaService.prescription.update.mockResolvedValue(mockUpdated);

      const result = await service.markAsCompleted('rx-1', 'assistant-1');

      expect(result.status).toBe('completed');
      expect(mockPrismaService.prescription.update).toHaveBeenCalledWith({
        where: { id: 'rx-1' },
        data: {
          status: 'completed',
          completedAt: expect.any(Date),
          readAt: new Date('2024-01-01'),
        },
        include: {
          patient: { select: { fullName: true } },
          doctor: { select: { fullName: true } },
        },
      });
    });

    it('should set readAt when completing a pending prescription directly', async () => {
      mockPrismaService.prescription.findUnique.mockResolvedValue({
        id: 'rx-1',
        assignedTo: 'assistant-1',
        status: 'pending',
        readAt: null,
      });

      mockPrismaService.prescription.update.mockResolvedValue({
        id: 'rx-1',
        status: 'completed',
        completedAt: new Date(),
        readAt: new Date(),
      });

      await service.markAsCompleted('rx-1', 'assistant-1');

      expect(mockPrismaService.prescription.update).toHaveBeenCalledWith({
        where: { id: 'rx-1' },
        data: {
          status: 'completed',
          completedAt: expect.any(Date),
          readAt: expect.any(Date),
        },
        include: {
          patient: { select: { fullName: true } },
          doctor: { select: { fullName: true } },
        },
      });
    });

    it('should return current state if already completed', async () => {
      const prescription = {
        id: 'rx-1',
        assignedTo: 'assistant-1',
        status: 'completed',
        completedAt: new Date(),
      };
      mockPrismaService.prescription.findUnique.mockResolvedValue(prescription);

      const result = await service.markAsCompleted('rx-1', 'assistant-1');

      expect(result).toEqual(prescription);
      expect(mockPrismaService.prescription.update).not.toHaveBeenCalled();
    });
  });

  describe('getEventStream', () => {
    it('should return an observable that filters events by assistantId', () => {
      const stream = service.getEventStream('assistant-1');
      expect(stream).toBeDefined();
      expect(stream.subscribe).toBeDefined();
    });

    it('should emit events only for the specified assistant', async () => {
      const events: MessageEvent[] = [];
      const stream = service.getEventStream('assistant-1');

      const subscription = stream.subscribe((event) => {
        events.push(event);
      });

      // Set up mocks for create
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'assistant-1',
        role: 'assistant',
        fullName: 'Assistant One',
      });

      mockPrismaService.prescription.create.mockResolvedValue({
        id: 'rx-1',
        doctorId: 'doctor-1',
        patientId: 'patient-1',
        content: 'Test prescription',
        assignedTo: 'assistant-1',
        status: 'pending',
        createdAt: new Date(),
        patient: { fullName: 'Patient One' },
        doctor: { fullName: 'Dr. Smith' },
      });

      // Create a prescription for assistant-1
      await service.create('doctor-1', 'patient-1', 'Test prescription', 'assistant-1');

      // Give time for the event to propagate
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(events.length).toBe(1);
      const eventData = JSON.parse(events[0].data as string);
      expect(eventData.type).toBe('new_prescription');
      expect(eventData.prescriptionId).toBe('rx-1');

      subscription.unsubscribe();
    });

    it('should NOT emit events for a different assistant', async () => {
      const events: MessageEvent[] = [];
      const stream = service.getEventStream('assistant-2');

      const subscription = stream.subscribe((event) => {
        events.push(event);
      });

      // Set up mocks for create targeting assistant-1
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'assistant-1',
        role: 'assistant',
        fullName: 'Assistant One',
      });

      mockPrismaService.prescription.create.mockResolvedValue({
        id: 'rx-1',
        doctorId: 'doctor-1',
        patientId: 'patient-1',
        content: 'Test prescription',
        assignedTo: 'assistant-1',
        status: 'pending',
        createdAt: new Date(),
        patient: { fullName: 'Patient One' },
        doctor: { fullName: 'Dr. Smith' },
      });

      // Create a prescription for assistant-1 (not assistant-2)
      await service.create('doctor-1', 'patient-1', 'Test prescription', 'assistant-1');

      await new Promise((resolve) => setTimeout(resolve, 10));

      // assistant-2 should NOT receive the event
      expect(events.length).toBe(0);

      subscription.unsubscribe();
    });
  });
});
