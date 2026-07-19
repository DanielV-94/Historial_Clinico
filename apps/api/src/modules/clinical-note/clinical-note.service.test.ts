import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ClinicalNoteService } from './clinical-note.service';
import { PrismaService } from '../../database/prisma.service';

/**
 * Unit tests for ClinicalNoteService.
 * Validates: Requirements 4.1, 4.2, 4.4
 */

describe('ClinicalNoteService', () => {
  let service: ClinicalNoteService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      clinicalNote: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
    };
    service = new ClinicalNoteService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    const patientId = '123e4567-e89b-12d3-a456-426614174000';
    const authorId = '223e4567-e89b-12d3-a456-426614174000';

    it('should create a clinical note with valid content', async () => {
      const content = 'Patient shows improvement after treatment.';
      const mockNote = {
        id: 'note-uuid',
        patientId,
        authorId,
        content,
        createdAt: new Date(),
      };
      prisma.clinicalNote.create.mockResolvedValue(mockNote);

      const result = await service.create(patientId, authorId, content);

      expect(result).toEqual(mockNote);
      expect(prisma.clinicalNote.create).toHaveBeenCalledWith({
        data: { patientId, authorId, content },
      });
    });

    it('should reject empty content', async () => {
      await expect(service.create(patientId, authorId, '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject content exceeding 10,000 characters', async () => {
      const longContent = 'a'.repeat(10_001);

      await expect(
        service.create(patientId, authorId, longContent),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept content at exactly 10,000 characters', async () => {
      const maxContent = 'a'.repeat(10_000);
      const mockNote = {
        id: 'note-uuid',
        patientId,
        authorId,
        content: maxContent,
        createdAt: new Date(),
      };
      prisma.clinicalNote.create.mockResolvedValue(mockNote);

      const result = await service.create(patientId, authorId, maxContent);

      expect(result).toEqual(mockNote);
    });

    it('should accept content with exactly 1 character', async () => {
      const minContent = 'X';
      const mockNote = {
        id: 'note-uuid',
        patientId,
        authorId,
        content: minContent,
        createdAt: new Date(),
      };
      prisma.clinicalNote.create.mockResolvedValue(mockNote);

      const result = await service.create(patientId, authorId, minContent);

      expect(result).toEqual(mockNote);
    });

    it('should record authorId and timestamp from creation', async () => {
      const content = 'Follow-up note.';
      const createdAt = new Date('2024-06-15T10:30:00Z');
      const mockNote = {
        id: 'note-uuid',
        patientId,
        authorId,
        content,
        createdAt,
      };
      prisma.clinicalNote.create.mockResolvedValue(mockNote);

      const result = await service.create(patientId, authorId, content);

      expect(result.authorId).toBe(authorId);
      expect(result.createdAt).toEqual(createdAt);
    });
  });

  describe('findByPatient', () => {
    const patientId = '123e4567-e89b-12d3-a456-426614174000';

    it('should return paginated notes ordered by createdAt DESC', async () => {
      const notes = [
        { id: 'n2', patientId, authorId: 'a1', content: 'Note 2', createdAt: new Date('2024-06-15') },
        { id: 'n1', patientId, authorId: 'a1', content: 'Note 1', createdAt: new Date('2024-06-14') },
      ];
      prisma.clinicalNote.findMany.mockResolvedValue(notes);
      prisma.clinicalNote.count.mockResolvedValue(2);

      const result = await service.findByPatient(patientId, 1, 20);

      expect(result.data).toEqual(notes);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.totalPages).toBe(1);
      expect(prisma.clinicalNote.findMany).toHaveBeenCalledWith({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should use default page size of 20', async () => {
      prisma.clinicalNote.findMany.mockResolvedValue([]);
      prisma.clinicalNote.count.mockResolvedValue(0);

      await service.findByPatient(patientId);

      expect(prisma.clinicalNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });

    it('should correctly calculate skip for page 2', async () => {
      prisma.clinicalNote.findMany.mockResolvedValue([]);
      prisma.clinicalNote.count.mockResolvedValue(25);

      const result = await service.findByPatient(patientId, 2, 20);

      expect(prisma.clinicalNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20 }),
      );
      expect(result.meta.totalPages).toBe(2);
    });

    it('should return empty data array when patient has no notes', async () => {
      prisma.clinicalNote.findMany.mockResolvedValue([]);
      prisma.clinicalNote.count.mockResolvedValue(0);

      const result = await service.findByPatient(patientId);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });
  });
});
