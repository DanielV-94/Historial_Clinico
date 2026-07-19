import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../database/prisma.service';

/**
 * Coordinate configuration for a single field in the letterhead template.
 */
interface FieldCoordinate {
  x: number;
  y: number;
  fontSize?: number;
  font?: string;
  maxWidth?: number;
  lineHeight?: number;
}

/**
 * Full letterhead configuration from Clinic.letterheadConfig JSON.
 */
interface LetterheadConfig {
  pageSize?: string;
  margins?: { top: number; right: number; bottom: number; left: number };
  fields?: {
    patientName?: FieldCoordinate;
    date?: FieldCoordinate;
    content?: FieldCoordinate;
    doctorSignature?: FieldCoordinate;
    footer?: FieldCoordinate;
  };
  templatePdfPath?: string;
}

/**
 * Data to inject into the PDF template.
 */
interface PrescriptionPdfData {
  patientName: string;
  date: string;
  content: string;
  doctorSignature: string;
  footer: string;
}

@Injectable()
export class PDFService {
  private readonly logger = new Logger(PDFService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a prescription PDF with the clinic's letterhead template or standard format.
   * Loads prescription data, clinic letterhead config, and produces a final PDF buffer.
   *
   * Performance target: ≤5 seconds for generation.
   *
   * @validates Requirements 6.4, 6.5
   */
  async generatePrescriptionPdf(prescriptionId: string): Promise<{
    buffer: Buffer;
    filename: string;
    warning?: string;
  }> {
    const startTime = Date.now();

    // Load prescription with related data
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        patient: { select: { fullName: true } },
        doctor: { select: { fullName: true } },
      },
    });

    if (!prescription) {
      throw new NotFoundException('Prescripción no encontrada');
    }

    // Load clinic's letterhead configuration
    const clinic = await this.prisma.clinic.findFirst({
      select: {
        name: true,
        letterheadConfig: true,
      },
    });

    const letterheadConfig = clinic?.letterheadConfig as LetterheadConfig | null;

    // Prepare data for injection
    const pdfData: PrescriptionPdfData = {
      patientName: prescription.patient.fullName,
      date: new Date(prescription.createdAt).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      content: prescription.content,
      doctorSignature: `Dr. ${prescription.doctor.fullName}`,
      footer: clinic?.name
        ? `${clinic.name} — Documento generado electrónicamente`
        : 'Documento generado electrónicamente',
    };

    let pdfBuffer: Buffer;
    let warning: string | undefined;

    // Try loading the template PDF if configured
    if (letterheadConfig?.templatePdfPath) {
      const templatePath = this.resolveTemplatePath(letterheadConfig.templatePdfPath);

      if (fs.existsSync(templatePath)) {
        this.logger.log(`Loading letterhead template from: ${templatePath}`);
        pdfBuffer = await this.generateWithTemplate(templatePath, letterheadConfig, pdfData);
      } else {
        this.logger.warn(`Template PDF not found at: ${templatePath}. Using standard format.`);
        warning = 'No se encontró plantilla de membrete. Se generó con formato estándar.';
        pdfBuffer = await this.generateStandardFormat(pdfData);
      }
    } else {
      this.logger.log('No letterhead template configured. Using standard format.');
      warning = 'No se encontró plantilla de membrete configurada. Se generó con formato estándar.';
      pdfBuffer = await this.generateStandardFormat(pdfData);
    }

    const elapsed = Date.now() - startTime;
    this.logger.log(`PDF generated in ${elapsed}ms for prescription ${prescriptionId}`);

    if (elapsed > 5000) {
      this.logger.warn(`PDF generation exceeded 5s target: ${elapsed}ms`);
    }

    const filename = `prescripcion_${prescription.patient.fullName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

    return { buffer: pdfBuffer, filename, warning };
  }

  /**
   * Generates a PDF by loading an existing template and injecting data at configured coordinates.
   */
  private async generateWithTemplate(
    templatePath: string,
    config: LetterheadConfig,
    data: PrescriptionPdfData,
  ): Promise<Buffer> {
    try {
      const templateBytes = fs.readFileSync(templatePath);
      const pdfDoc = await PDFDocument.load(templateBytes);
      const pages = pdfDoc.getPages();
      const page = pages[0];

      // Embed fonts
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const fields = config.fields || {};

      // Inject patient name
      if (fields.patientName) {
        const font = fields.patientName.font === 'Helvetica-Bold' ? helveticaBold : helvetica;
        page.drawText(data.patientName, {
          x: fields.patientName.x,
          y: fields.patientName.y,
          size: fields.patientName.fontSize || 12,
          font,
          color: rgb(0, 0, 0),
        });
      }

      // Inject date
      if (fields.date) {
        const font = fields.date.font === 'Helvetica-Bold' ? helveticaBold : helvetica;
        page.drawText(data.date, {
          x: fields.date.x,
          y: fields.date.y,
          size: fields.date.fontSize || 10,
          font,
          color: rgb(0, 0, 0),
        });
      }

      // Inject content (multi-line)
      if (fields.content) {
        const font = fields.content.font === 'Helvetica-Bold' ? helveticaBold : helvetica;
        const fontSize = fields.content.fontSize || 11;
        const maxWidth = fields.content.maxWidth || 520;
        const lineHeight = fields.content.lineHeight || 14;

        this.drawMultilineText(page, data.content, {
          x: fields.content.x,
          y: fields.content.y,
          fontSize,
          font,
          maxWidth,
          lineHeight,
        });
      }

      // Inject doctor signature
      if (fields.doctorSignature) {
        const font = fields.doctorSignature.font === 'Helvetica-Bold' ? helveticaBold : helvetica;
        page.drawText(data.doctorSignature, {
          x: fields.doctorSignature.x,
          y: fields.doctorSignature.y,
          size: fields.doctorSignature.fontSize || 10,
          font,
          color: rgb(0, 0, 0),
        });
      }

      // Inject footer
      if (fields.footer) {
        const font = fields.footer.font === 'Helvetica-Bold' ? helveticaBold : helvetica;
        page.drawText(data.footer, {
          x: fields.footer.x,
          y: fields.footer.y,
          size: fields.footer.fontSize || 8,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
      }

      const pdfBytes = await pdfDoc.save();
      return Buffer.from(pdfBytes);
    } catch (error) {
      this.logger.error(`Error generating PDF with template: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al generar PDF con plantilla de membrete');
    }
  }

  /**
   * Generates a standard-format PDF without a template when no letterhead is configured.
   * Creates a clean, professional prescription document.
   *
   * @validates Requirements 6.5 (fallback format)
   */
  private async generateStandardFormat(data: PrescriptionPdfData): Promise<Buffer> {
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([612, 792]); // Letter size

      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const { width, height } = page.getSize();
      const margin = 50;
      let yPosition = height - 60;

      // Header — clinic name (or generic title)
      page.drawText('PRESCRIPCIÓN MÉDICA', {
        x: margin,
        y: yPosition,
        size: 18,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });
      yPosition -= 30;

      // Divider line
      page.drawLine({
        start: { x: margin, y: yPosition },
        end: { x: width - margin, y: yPosition },
        thickness: 1,
        color: rgb(0.7, 0.7, 0.7),
      });
      yPosition -= 25;

      // Patient name
      page.drawText('Paciente:', {
        x: margin,
        y: yPosition,
        size: 10,
        font: helveticaBold,
        color: rgb(0.3, 0.3, 0.3),
      });
      page.drawText(data.patientName, {
        x: margin + 60,
        y: yPosition,
        size: 12,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });

      // Date (right-aligned)
      page.drawText(`Fecha: ${data.date}`, {
        x: width - margin - 200,
        y: yPosition,
        size: 10,
        font: helvetica,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 30;

      // Divider
      page.drawLine({
        start: { x: margin, y: yPosition },
        end: { x: width - margin, y: yPosition },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.85),
      });
      yPosition -= 25;

      // Content
      page.drawText('Indicaciones:', {
        x: margin,
        y: yPosition,
        size: 10,
        font: helveticaBold,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 18;

      this.drawMultilineText(page, data.content, {
        x: margin,
        y: yPosition,
        fontSize: 11,
        font: helvetica,
        maxWidth: width - margin * 2,
        lineHeight: 15,
      });

      // Doctor signature — near the bottom
      const signatureY = 120;
      page.drawLine({
        start: { x: 200, y: signatureY + 15 },
        end: { x: 420, y: signatureY + 15 },
        thickness: 0.5,
        color: rgb(0, 0, 0),
      });
      page.drawText(data.doctorSignature, {
        x: 220,
        y: signatureY,
        size: 10,
        font: helvetica,
        color: rgb(0, 0, 0),
      });

      // Footer
      page.drawText(data.footer, {
        x: margin,
        y: 40,
        size: 8,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });

      const pdfBytes = await pdfDoc.save();
      return Buffer.from(pdfBytes);
    } catch (error) {
      this.logger.error(`Error generating standard PDF: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al generar PDF de prescripción');
    }
  }

  /**
   * Draws multi-line text within a given maxWidth, wrapping words at boundaries.
   */
  private drawMultilineText(
    page: PDFPage,
    text: string,
    options: {
      x: number;
      y: number;
      fontSize: number;
      font: PDFFont;
      maxWidth: number;
      lineHeight: number;
    },
  ): void {
    const { x, y, fontSize, font, maxWidth, lineHeight } = options;

    const paragraphs = text.split('\n');
    let currentY = y;

    for (const paragraph of paragraphs) {
      const words = paragraph.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);

        if (testWidth > maxWidth && currentLine) {
          page.drawText(currentLine, {
            x,
            y: currentY,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
          });
          currentY -= lineHeight;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      // Draw the last line of the paragraph
      if (currentLine) {
        page.drawText(currentLine, {
          x,
          y: currentY,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
        currentY -= lineHeight;
      }

      // Extra spacing between paragraphs
      currentY -= lineHeight * 0.3;
    }
  }

  /**
   * Resolves the template PDF path relative to the data directory.
   */
  private resolveTemplatePath(configuredPath: string): string {
    // If it's an absolute path, use it directly
    if (path.isAbsolute(configuredPath)) {
      return configuredPath;
    }

    // Resolve relative to the configured data directory or project root
    const dataDir = process.env.FILE_STORAGE_PATH || path.join(process.cwd(), 'data', 'clinic-files');
    return path.join(dataDir, configuredPath);
  }
}
