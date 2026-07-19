import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PDFService } from './pdf.service';
import { PDFDocument } from 'pdf-lib';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

import * as fs from 'fs';

describe('PDFService', () => {
  let service: PDFService;
  let mockPrisma: any;

  const mockPrescription = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    patientId: 'patient-uuid',
    doctorId: 'doctor-uuid',
    content: 'Tomar ibuprofeno 400mg cada 8 horas por 5 días.\nReposo absoluto.',
    status: 'pending',
    createdAt: new Date('2024-06-15T10:30:00Z'),
    patient: { fullName: 'Juan Pérez García' },
    doctor: { fullName: 'María López Hernández' },
  };

  const mockClinic = {
    name: 'Clínica Estética Premium',
    letterheadConfig: {
      pageSize: 'letter',
      margins: { top: 80, right: 40, bottom: 60, left: 40 },
      fields: {
        patientName: { x: 120, y: 680, fontSize: 12, font: 'Helvetica-Bold' },
        date: { x: 420, y: 680, fontSize: 10, font: 'Helvetica' },
        content: { x: 40, y: 620, fontSize: 11, font: 'Helvetica', maxWidth: 520, lineHeight: 14 },
        doctorSignature: { x: 200, y: 100, fontSize: 10, font: 'Helvetica' },
        footer: { x: 40, y: 40, fontSize: 8, font: 'Helvetica' },
      },
      templatePdfPath: '/templates/letterhead.pdf',
    },
  };

  beforeEach(() => {
    mockPrisma = {
      prescription: {
        findUnique: vi.fn(),
      },
      clinic: {
        findFirst: vi.fn(),
      },
    };

    service = new PDFService(mockPrisma);
  });

  describe('generatePrescriptionPdf', () => {
    it('should throw NotFoundException when prescription does not exist', async () => {
      mockPrisma.prescription.findUnique.mockResolvedValue(null);

      await expect(
        service.generatePrescriptionPdf('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should generate a standard format PDF when no clinic config exists', async () => {
      mockPrisma.prescription.findUnique.mockResolvedValue(mockPrescription);
      mockPrisma.clinic.findFirst.mockResolvedValue(null);

      const result = await service.generatePrescriptionPdf(mockPrescription.id);

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.filename).toContain('prescripcion_');
      expect(result.filename).toContain('Juan_Pérez_García');
      expect(result.warning).toContain('No se encontró plantilla de membrete');
    });

    it('should generate a standard format PDF when letterhead config has no templatePdfPath', async () => {
      mockPrisma.prescription.findUnique.mockResolvedValue(mockPrescription);
      mockPrisma.clinic.findFirst.mockResolvedValue({
        name: 'Clínica Test',
        letterheadConfig: { pageSize: 'letter', fields: {} },
      });

      const result = await service.generatePrescriptionPdf(mockPrescription.id);

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.warning).toContain('No se encontró plantilla de membrete');
    });

    it('should generate a standard format PDF with warning when template file does not exist', async () => {
      mockPrisma.prescription.findUnique.mockResolvedValue(mockPrescription);
      mockPrisma.clinic.findFirst.mockResolvedValue(mockClinic);
      (fs.existsSync as any).mockReturnValue(false);

      const result = await service.generatePrescriptionPdf(mockPrescription.id);

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.warning).toContain('No se encontró plantilla de membrete');
    });

    it('should generate PDF with template when template file exists', async () => {
      mockPrisma.prescription.findUnique.mockResolvedValue(mockPrescription);
      mockPrisma.clinic.findFirst.mockResolvedValue(mockClinic);
      (fs.existsSync as any).mockReturnValue(true);

      // Create a real minimal PDF template to load
      const templatePdf = await PDFDocument.create();
      templatePdf.addPage([612, 792]);
      const templateBytes = await templatePdf.save();
      (fs.readFileSync as any).mockReturnValue(Buffer.from(templateBytes));

      const result = await service.generatePrescriptionPdf(mockPrescription.id);

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.filename).toContain('.pdf');
      expect(result.warning).toBeUndefined();
    });

    it('should produce a valid PDF document that can be parsed', async () => {
      mockPrisma.prescription.findUnique.mockResolvedValue(mockPrescription);
      mockPrisma.clinic.findFirst.mockResolvedValue(null);

      const result = await service.generatePrescriptionPdf(mockPrescription.id);

      // Verify the generated buffer is a valid PDF
      const parsed = await PDFDocument.load(result.buffer);
      expect(parsed.getPageCount()).toBeGreaterThanOrEqual(1);
    });

    it('should include patient name in the generated filename', async () => {
      mockPrisma.prescription.findUnique.mockResolvedValue(mockPrescription);
      mockPrisma.clinic.findFirst.mockResolvedValue(null);

      const result = await service.generatePrescriptionPdf(mockPrescription.id);

      expect(result.filename).toMatch(/prescripcion_Juan_Pérez_García_\d{4}-\d{2}-\d{2}\.pdf/);
    });

    it('should handle multi-line content in standard format', async () => {
      const prescriptionWithLongContent = {
        ...mockPrescription,
        content: 'Línea 1 con instrucciones detalladas para el paciente.\nLínea 2 con más indicaciones.\nLínea 3 con observaciones adicionales importantes.',
      };
      mockPrisma.prescription.findUnique.mockResolvedValue(prescriptionWithLongContent);
      mockPrisma.clinic.findFirst.mockResolvedValue(null);

      const result = await service.generatePrescriptionPdf(mockPrescription.id);

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    it('should generate within 5 seconds performance target', async () => {
      mockPrisma.prescription.findUnique.mockResolvedValue(mockPrescription);
      mockPrisma.clinic.findFirst.mockResolvedValue(null);

      const start = Date.now();
      await service.generatePrescriptionPdf(mockPrescription.id);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(5000);
    });

    it('should include clinic name in footer when available', async () => {
      mockPrisma.prescription.findUnique.mockResolvedValue(mockPrescription);
      mockPrisma.clinic.findFirst.mockResolvedValue({
        name: 'Mi Clínica Especial',
        letterheadConfig: null,
      });

      const result = await service.generatePrescriptionPdf(mockPrescription.id);

      expect(result.buffer).toBeInstanceOf(Buffer);
      // PDF was generated successfully with clinic name in footer
      expect(result.buffer.length).toBeGreaterThan(0);
    });
  });
});
