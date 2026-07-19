import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FileService } from './file.service';
import * as crypto from 'crypto';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockResolvedValue(undefined),
}));

// Create mock Prisma service
const mockPrismaService = {
  fileMetadata: {
    create: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
  },
};

// Create mock ConfigService
const mockConfigService = {
  get: vi.fn().mockReturnValue('/data/clinic-files'),
};

describe('FileService', () => {
  let service: FileService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FileService(
      mockPrismaService as any,
      mockConfigService as any,
    );
  });

  describe('validateFile', () => {
    it('should accept a valid PDF file', () => {
      const checksum = crypto.createHash('sha256').update('test').digest('hex');
      const result = service.validateFile('application/pdf', 1024 * 1024, checksum);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should accept a valid JPEG image', () => {
      const checksum = crypto.createHash('sha256').update('image').digest('hex');
      const result = service.validateFile('image/jpeg', 10 * 1024 * 1024, checksum);
      expect(result.valid).toBe(true);
    });

    it('should accept a valid MP4 video', () => {
      const checksum = crypto.createHash('sha256').update('video').digest('hex');
      const result = service.validateFile('video/mp4', 100 * 1024 * 1024, checksum);
      expect(result.valid).toBe(true);
    });

    it('should reject an invalid MIME type', () => {
      const checksum = crypto.createHash('sha256').update('test').digest('hex');
      const result = service.validateFile('application/exe', 1024, checksum);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some((e) => e.message.includes('Formato no permitido'))).toBe(true);
    });

    it('should reject a PDF exceeding 20MB', () => {
      const checksum = crypto.createHash('sha256').update('test').digest('hex');
      const result = service.validateFile('application/pdf', 21 * 1024 * 1024, checksum);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject an image exceeding 50MB', () => {
      const checksum = crypto.createHash('sha256').update('test').digest('hex');
      const result = service.validateFile('image/jpeg', 51 * 1024 * 1024, checksum);
      expect(result.valid).toBe(false);
    });

    it('should reject a video exceeding 200MB', () => {
      const checksum = crypto.createHash('sha256').update('test').digest('hex');
      const result = service.validateFile('video/mp4', 201 * 1024 * 1024, checksum);
      expect(result.valid).toBe(false);
    });

    it('should reject an invalid checksum', () => {
      const result = service.validateFile('application/pdf', 1024, 'invalid-checksum');
      expect(result.valid).toBe(false);
      expect(result.errors!.some((e) => e.message.includes('SHA-256'))).toBe(true);
    });

    it('should reject zero-size file', () => {
      const checksum = crypto.createHash('sha256').update('test').digest('hex');
      const result = service.validateFile('application/pdf', 0, checksum);
      expect(result.valid).toBe(false);
    });
  });

  describe('computeChecksum', () => {
    it('should return a valid SHA-256 hex string', () => {
      const buffer = Buffer.from('hello world');
      const result = service.computeChecksum(buffer);
      expect(result).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce consistent checksums for the same input', () => {
      const buffer = Buffer.from('test data');
      const result1 = service.computeChecksum(buffer);
      const result2 = service.computeChecksum(buffer);
      expect(result1).toBe(result2);
    });

    it('should produce different checksums for different inputs', () => {
      const buffer1 = Buffer.from('data1');
      const buffer2 = Buffer.from('data2');
      expect(service.computeChecksum(buffer1)).not.toBe(service.computeChecksum(buffer2));
    });
  });

  describe('generateUniqueName', () => {
    it('should follow pattern: YYYY-MM-DD_type_uuid.ext', () => {
      const name = service.generateUniqueName('estudio.pdf', 'radiografia-torax');
      expect(name).toMatch(/^\d{4}-\d{2}-\d{2}_radiografia-torax_[a-f0-9]{8}\.pdf$/);
    });

    it('should use "archivo" when no study type is provided', () => {
      const name = service.generateUniqueName('document.pdf');
      expect(name).toMatch(/^\d{4}-\d{2}-\d{2}_archivo_[a-f0-9]{8}\.pdf$/);
    });

    it('should normalize study type with special characters', () => {
      const name = service.generateUniqueName('foto.jpg', 'Radiografía de Tórax');
      expect(name).toMatch(/^\d{4}-\d{2}-\d{2}_radiografia-de-torax_[a-f0-9]{8}\.jpg$/);
    });

    it('should preserve the file extension in lowercase', () => {
      const name = service.generateUniqueName('IMAGE.PNG', 'foto');
      expect(name).toContain('.png');
    });

    it('should generate unique names on each call', () => {
      const name1 = service.generateUniqueName('file.pdf', 'test');
      const name2 = service.generateUniqueName('file.pdf', 'test');
      expect(name1).not.toBe(name2);
    });
  });

  describe('buildStoragePath', () => {
    it('should build path for PDF category as documents/', () => {
      const result = service.buildStoragePath('patient-123', 'pdf');
      expect(result).toContain('patients');
      expect(result).toContain('patient-123');
      expect(result).toContain('documents');
    });

    it('should build path for image category as gallery/images/', () => {
      const result = service.buildStoragePath('patient-456', 'image');
      expect(result).toContain('patients');
      expect(result).toContain('patient-456');
      expect(result).toContain('gallery');
      expect(result).toContain('images');
    });

    it('should build path for video category as gallery/videos/', () => {
      const result = service.buildStoragePath('patient-789', 'video');
      expect(result).toContain('patients');
      expect(result).toContain('patient-789');
      expect(result).toContain('gallery');
      expect(result).toContain('videos');
    });
  });

  describe('checkDuplicateName', () => {
    it('should return isDuplicate:true when a file with same name exists', async () => {
      mockPrismaService.fileMetadata.findFirst.mockResolvedValue({
        id: 'file-1',
        originalName: 'estudio.pdf',
        uniqueName: '2024-01-01_estudio_abc12345.pdf',
        uploadedAt: new Date('2024-01-01'),
      });

      const result = await service.checkDuplicateName('patient-1', 'pdf', 'estudio.pdf');
      expect(result.isDuplicate).toBe(true);
      expect(result.existingFile).toBeDefined();
      expect(result.existingFile!.originalName).toBe('estudio.pdf');
    });

    it('should return isDuplicate:false when no matching file exists', async () => {
      mockPrismaService.fileMetadata.findFirst.mockResolvedValue(null);

      const result = await service.checkDuplicateName('patient-1', 'pdf', 'new-file.pdf');
      expect(result.isDuplicate).toBe(false);
      expect(result.existingFile).toBeUndefined();
    });
  });

  describe('upload', () => {
    const validBuffer = Buffer.from('valid file content');
    const validMetadata = {
      originalName: 'estudio.pdf',
      mimeType: 'application/pdf',
      studyType: 'radiografia',
    };

    it('should throw BadRequestException for invalid MIME type', async () => {
      const metadata = { ...validMetadata, mimeType: 'application/exe' };
      await expect(
        service.upload('patient-1', validBuffer, metadata, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for duplicate file name', async () => {
      mockPrismaService.fileMetadata.findFirst.mockResolvedValue({
        id: 'existing-file',
        originalName: 'estudio.pdf',
        uniqueName: '2024-01-01_estudio_abc.pdf',
        uploadedAt: new Date(),
      });

      await expect(
        service.upload('patient-1', validBuffer, validMetadata, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should upload successfully when validation passes and no duplicate', async () => {
      mockPrismaService.fileMetadata.findFirst.mockResolvedValue(null); // no duplicate
      mockPrismaService.fileMetadata.create.mockResolvedValue({
        id: 'new-file-id',
        patientId: 'patient-1',
        originalName: 'estudio.pdf',
        uniqueName: '2024-01-01_radiografia_abc12345.pdf',
        storagePath: 'patients/patient-1/documents/2024-01-01_radiografia_abc12345.pdf',
        mimeType: 'application/pdf',
        sizeBytes: BigInt(validBuffer.length),
        checksum: crypto.createHash('sha256').update(validBuffer).digest('hex'),
        category: 'pdf',
        studyType: 'radiografia',
        uploadedAt: new Date(),
      });

      const result = await service.upload('patient-1', validBuffer, validMetadata, 'user-1');
      expect(result.id).toBe('new-file-id');
      expect(result.patientId).toBe('patient-1');
      expect(result.category).toBe('pdf');
      expect(mockPrismaService.fileMetadata.create).toHaveBeenCalled();
    });
  });

  describe('download', () => {
    it('should throw NotFoundException when file does not exist', async () => {
      mockPrismaService.fileMetadata.findFirst.mockResolvedValue(null);

      await expect(
        service.download('patient-1', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return file path and metadata for existing file', async () => {
      mockPrismaService.fileMetadata.findFirst.mockResolvedValue({
        id: 'file-1',
        patientId: 'patient-1',
        storagePath: 'patients/patient-1/documents/test.pdf',
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
      });

      const result = await service.download('patient-1', 'file-1');
      expect(result.filePath).toContain('patients');
      expect(result.filePath).toContain('test.pdf');
      expect(result.metadata).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should throw NotFoundException when file does not exist', async () => {
      mockPrismaService.fileMetadata.findFirst.mockResolvedValue(null);

      await expect(
        service.delete('patient-1', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete file from disk and DB for existing file', async () => {
      mockPrismaService.fileMetadata.findFirst.mockResolvedValue({
        id: 'file-1',
        patientId: 'patient-1',
        storagePath: 'patients/patient-1/documents/test.pdf',
      });
      mockPrismaService.fileMetadata.delete.mockResolvedValue({});

      await service.delete('patient-1', 'file-1');
      expect(mockPrismaService.fileMetadata.delete).toHaveBeenCalledWith({
        where: { id: 'file-1' },
      });
    });
  });
});
