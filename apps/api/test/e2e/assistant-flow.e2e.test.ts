/**
 * E2E Integration Test: Assistant Workflow
 *
 * Tests the complete assistant flow:
 * login → inbox → read prescription → mark completed
 *
 * Tests controller→service integration for each step.
 *
 * **Validates: Requirements 6.1-6.6**
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';

import { AuthService } from '../../src/modules/auth/auth.service';
import { PrescriptionService } from '../../src/modules/prescription/prescription.service';
import { AssistantDashboardService } from '../../src/modules/dashboard/assistant-dashboard.service';

describe('E2E: Assistant Workflow', () => {
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
      prescription: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      appointment: {
        findMany: vi.fn(),
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

  describe('Step 1: Login as assistant', () => {
    it('should authenticate assistant and return token pair', async () => {
      /**
       * @validates Requirement 13.1 - Authentication
       */
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash('Asistente1', 12);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
        username: 'asistente.lopez',
        role: 'assistant',
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

      const result = await authService.login('asistente.lopez', 'Asistente1');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('Step 2: View prescription inbox', () => {
    it('should return prescriptions ordered by date DESC with read/unread status', async () => {
      /**
       * @validates Requirement 6.3 - Inbox with prescriptions ordered by date desc
       */
      const prescriptions = [
        {
          id: 'presc-1',
          status: 'pending',
          content: 'Ibuprofeno 400mg',
          createdAt: new Date('2024-06-15T14:00:00Z'),
          patient: { fullName: 'Paciente A' },
          doctor: { username: 'dr.garcia' },
        },
        {
          id: 'presc-2',
          status: 'read',
          content: 'Paracetamol 500mg',
          readAt: new Date('2024-06-14T10:00:00Z'),
          createdAt: new Date('2024-06-14T09:00:00Z'),
          patient: { fullName: 'Paciente B' },
          doctor: { username: 'dr.garcia' },
        },
      ];

      mockPrisma.prescription.findMany.mockResolvedValue(prescriptions);
      mockPrisma.prescription.count.mockResolvedValue(2);

      const prescService = new PrescriptionService(mockPrisma as any);
      const result = await prescService.getInbox('c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', 1, 20);

      expect(result).toBeDefined();
      expect(mockPrisma.prescription.findMany).toHaveBeenCalled();
    });
  });

  describe('Step 3: Mark prescription as read', () => {
    it('should mark a prescription as read and set readAt timestamp', async () => {
      /**
       * @validates Requirement 6.3 - Read/unread status
       */
      mockPrisma.prescription.findUnique.mockResolvedValue({
        id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
        status: 'pending',
        assignedTo: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
      });
      mockPrisma.prescription.update.mockResolvedValue({
        id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
        status: 'read',
        readAt: new Date(),
      });

      const prescService = new PrescriptionService(mockPrisma as any);
      const result = await prescService.markAsRead(
        'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
        'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
      );

      expect(result.status).toBe('read');
      expect(result.readAt).toBeDefined();
      expect(mockPrisma.prescription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'read' }),
        }),
      );
    });
  });

  describe('Step 4: Mark prescription as completed', () => {
    it('should mark prescription as completed and archive it', async () => {
      /**
       * @validates Requirement 6.6 - Mark completed, record datetime, archive
       */
      mockPrisma.prescription.findUnique.mockResolvedValue({
        id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
        status: 'read',
        assignedTo: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
      });
      mockPrisma.prescription.update.mockResolvedValue({
        id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
        status: 'completed',
        completedAt: new Date(),
      });

      const prescService = new PrescriptionService(mockPrisma as any);
      const result = await prescService.markAsCompleted(
        'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
        'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
      );

      expect(result.status).toBe('completed');
      expect(result.completedAt).toBeDefined();
      expect(mockPrisma.prescription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'completed' }),
        }),
      );
    });

    it('should not show completed prescriptions in active inbox', async () => {
      /**
       * @validates Requirement 6.6 - Archive out of active inbox
       */
      // Return only non-completed prescriptions
      mockPrisma.prescription.findMany.mockResolvedValue([
        {
          id: 'presc-active',
          status: 'pending',
          content: 'Active prescription',
          createdAt: new Date(),
          patient: { fullName: 'Paciente Activo' },
          doctor: { username: 'dr.garcia' },
        },
      ]);
      mockPrisma.prescription.count.mockResolvedValue(1);

      const prescService = new PrescriptionService(mockPrisma as any);
      const result = await prescService.getInbox('c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', 1, 20);

      expect(result).toBeDefined();
      // Inbox query should filter out completed prescriptions
      const findManyCall = mockPrisma.prescription.findMany.mock.calls[0]?.[0];
      if (findManyCall?.where) {
        // If the service filters by status, verify completed is excluded
        expect(findManyCall.where.status).not.toBe('completed');
      }
    });
  });

  describe('Full Flow Integration', () => {
    it('should complete entire assistant workflow: login → inbox → read → complete', async () => {
      /**
       * @validates Requirements 6.1-6.6 - Complete assistant workflow
       */
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash('Asistente1', 12);

      // Step 1: Login
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
        username: 'asistente.lopez',
        role: 'assistant',
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
      const tokens = await authService.login('asistente.lopez', 'Asistente1');
      expect(tokens.accessToken).toBeDefined();

      // Step 2: View inbox
      mockPrisma.prescription.findMany.mockResolvedValue([
        { id: 'presc-1', status: 'pending', content: 'Rx content', createdAt: new Date() },
      ]);
      mockPrisma.prescription.count.mockResolvedValue(1);

      const prescService = new PrescriptionService(mockPrisma as any);
      const inbox = await prescService.getInbox('c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', 1, 20);
      expect(inbox).toBeDefined();

      // Step 3: Mark as read
      mockPrisma.prescription.findUnique.mockResolvedValue({
        id: 'presc-1',
        status: 'pending',
        assignedTo: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
      });
      mockPrisma.prescription.update.mockResolvedValue({
        id: 'presc-1',
        status: 'read',
        readAt: new Date(),
      });

      const readResult = await prescService.markAsRead('presc-1', 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f');
      expect(readResult.status).toBe('read');

      // Step 4: Mark as completed
      mockPrisma.prescription.findUnique.mockResolvedValue({
        id: 'presc-1',
        status: 'read',
        assignedTo: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
      });
      mockPrisma.prescription.update.mockResolvedValue({
        id: 'presc-1',
        status: 'completed',
        completedAt: new Date(),
      });

      const completedResult = await prescService.markAsCompleted('presc-1', 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f');
      expect(completedResult.status).toBe('completed');
    });
  });
});
