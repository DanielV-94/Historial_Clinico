import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Res,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { PDFService } from './pdf.service';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('prescriptions')
export class PDFController {
  private readonly logger = new Logger(PDFController.name);

  constructor(private readonly pdfService: PDFService) {}

  /**
   * GET /prescriptions/:id/pdf
   * Generates and streams the prescription PDF with the clinic's letterhead.
   * If no letterhead template is configured, generates a standard format PDF.
   *
   * Returns Content-Type: application/pdf with Content-Disposition: inline.
   *
   * @validates Requirements 6.4, 6.5
   */
  @Roles('assistant', 'doctor', 'admin')
  @Get(':id/pdf')
  async generatePdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const result = await this.pdfService.generatePrescriptionPdf(id);

    // Set headers for PDF streaming
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(result.filename)}"`,
    );
    res.setHeader('Content-Length', result.buffer.length);

    // Include warning header if letterhead was not found
    if (result.warning) {
      res.setHeader('X-PDF-Warning', result.warning);
    }

    this.logger.log(`Streaming PDF for prescription ${id} (${result.buffer.length} bytes)`);

    res.end(result.buffer);
  }
}
