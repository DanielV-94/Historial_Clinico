import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Req,
  Res,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  HttpException,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response, Request } from 'express';
import {
  DOCUMENTS_PAGE_SIZE,
  PDF_MAX_SIZE,
  IMAGE_MAX_SIZE,
  VIDEO_MAX_SIZE,
  ALLOWED_PDF_MIMES,
  ALLOWED_IMAGE_MIMES,
  ALLOWED_VIDEO_MIMES,
} from '@historial/constants';
import { getCategoryFromMime } from '@historial/validators';

import { Roles } from '../../common/decorators/roles.decorator';
import { ConfigService } from '@nestjs/config';
import { FileService } from './file.service';
import { WatermarkService } from './watermark.service';
import { DiskSpaceService } from './disk-space.service';
import { PrismaService } from '../../database/prisma.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

/**
 * FileController handles document (PDF) and gallery (image/video) endpoints
 * for a given patient. All endpoints require 'doctor' or 'admin' role.
 *
 * Documents: POST/GET/DELETE /patients/:patientId/documents
 * Gallery:   POST/GET /patients/:patientId/gallery
 *
 * @validates Requirements 2.1, 2.2, 2.3, 2.5, 2.6, 3.1, 3.2, 3.5, 3.6
 */
@Controller('patients/:patientId')
@Roles('doctor', 'admin')
export class FileController {
  constructor(
    private readonly fileService: FileService,
    private readonly watermarkService: WatermarkService,
    private readonly diskSpaceService: DiskSpaceService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ─── DOCUMENTS ENDPOINTS ───────────────────────────────────────────────────

  /**
   * POST /patients/:patientId/documents
   * Uploads a PDF document to the patient's expediente.
   * Validates: MIME must be application/pdf, size ≤ 20 MB.
   *
   * @validates Requirements 2.1, 2.4
   */
  @Post('documents')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
    @Query('studyType') studyType?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó un archivo');
    }

    // Validate PDF MIME type
    if (!ALLOWED_PDF_MIMES.includes(file.mimetype as any)) {
      throw new BadRequestException(
        `Formato inválido: solo se aceptan archivos PDF (application/pdf). Recibido: ${file.mimetype}`,
      );
    }

    // Validate PDF size limit (≤ 20 MB)
    if (file.size > PDF_MAX_SIZE) {
      const maxMB = PDF_MAX_SIZE / (1024 * 1024);
      throw new BadRequestException(
        `El archivo excede el tamaño máximo permitido para PDF (${maxMB} MB)`,
      );
    }

    // Check disk space
    const hasSpace = await this.diskSpaceService.hasEnoughSpace(file.size);
    if (!hasSpace) {
      throw new HttpException(
        'Espacio en disco insuficiente. Contacte al administrador.',
        507,
      );
    }

    const user = (req as any).user as JwtPayload;

    const result = await this.fileService.upload(
      patientId,
      file.buffer,
      {
        originalName: file.originalname,
        mimeType: file.mimetype,
        studyType: studyType || undefined,
      },
      user.sub,
    );

    return {
      message: 'Documento subido exitosamente',
      data: {
        id: result.id,
        patientId: result.patientId,
        originalName: result.originalName,
        uniqueName: result.uniqueName,
        mimeType: result.mimeType,
        sizeBytes: result.sizeBytes.toString(),
        category: result.category,
        studyType: result.studyType,
        uploadedAt: result.uploadedAt,
      },
    };
  }

  /**
   * GET /patients/:patientId/documents
   * Lists PDF documents for a patient, paginated (20 per page), ordered by uploadedAt DESC.
   *
   * @validates Requirements 2.3
   */
  @Get('documents')
  async listDocuments(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query('page') page?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limit = DOCUMENTS_PAGE_SIZE;
    const skip = (pageNum - 1) * limit;

    const [documents, total] = await Promise.all([
      this.prisma.fileMetadata.findMany({
        where: {
          patientId,
          category: 'pdf',
        },
        orderBy: { uploadedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          originalName: true,
          uniqueName: true,
          mimeType: true,
          sizeBytes: true,
          studyType: true,
          uploadedAt: true,
          uploader: {
            select: { id: true, fullName: true },
          },
        },
      }),
      this.prisma.fileMetadata.count({
        where: {
          patientId,
          category: 'pdf',
        },
      }),
    ]);

    return {
      data: documents.map((doc) => ({
        ...doc,
        sizeBytes: doc.sizeBytes.toString(),
      })),
      meta: {
        total,
        page: pageNum,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * GET /patients/:patientId/documents/:docId/preview
   * Streams the PDF file for inline preview with correct Content-Type header.
   *
   * @validates Requirements 2.2
   */
  @Get('documents/:docId/preview')
  async previewDocument(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @Res() res: Response,
  ) {
    const { filePath, metadata } = await this.fileService.download(
      patientId,
      docId,
    );

    res.setHeader('Content-Type', metadata.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${metadata.originalName}"`,
    );
    res.setHeader('Content-Length', metadata.sizeBytes.toString());

    // Stream the file
    const { createReadStream } = await import('fs');
    const stream = createReadStream(filePath);
    stream.pipe(res);
  }

  /**
   * DELETE /patients/:patientId/documents/:docId
   * Deletes a PDF document from the patient's expediente (disk + database).
   * Frontend must confirm before calling this endpoint.
   *
   * @validates Requirements 2.5
   */
  @Delete('documents/:docId')
  @HttpCode(HttpStatus.OK)
  async deleteDocument(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('docId', ParseUUIDPipe) docId: string,
  ) {
    await this.fileService.delete(patientId, docId);

    return {
      message: 'Documento eliminado exitosamente',
    };
  }

  // ─── GALLERY ENDPOINTS ─────────────────────────────────────────────────────

  /**
   * POST /patients/:patientId/gallery
   * Uploads an image or video to the patient's gallery.
   * Validates: images (JPEG/PNG/HEIC ≤ 50 MB), videos (MP4/MOV ≤ 200 MB).
   * Applies watermark if enabled in clinic configuration.
   *
   * @validates Requirements 3.1, 3.4, 3.5, 3.6
   */
  @Post('gallery')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadGalleryItem(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
    @Query('captureDate') captureDate?: string,
    @Query('anatomicalZone') anatomicalZone?: string,
    @Query('notes') notes?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó un archivo');
    }

    const allGalleryMimes = [
      ...ALLOWED_IMAGE_MIMES,
      ...ALLOWED_VIDEO_MIMES,
    ] as readonly string[];

    // Validate MIME type (images + videos only)
    if (!allGalleryMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Formato inválido. Formatos permitidos — Imagen: JPEG, PNG, HEIC. Video: MP4, MOV. Recibido: ${file.mimetype}`,
      );
    }

    // Determine category and validate size
    const category = getCategoryFromMime(file.mimetype);
    if (!category || category === 'pdf') {
      throw new BadRequestException(
        'Los PDFs deben subirse al endpoint de documentos (/documents)',
      );
    }

    const maxSize = category === 'image' ? IMAGE_MAX_SIZE : VIDEO_MAX_SIZE;
    if (file.size > maxSize) {
      const maxMB = maxSize / (1024 * 1024);
      throw new BadRequestException(
        `El archivo excede el tamaño máximo permitido para ${category === 'image' ? 'imagen' : 'video'} (${maxMB} MB)`,
      );
    }

    // Check disk space
    const hasSpace = await this.diskSpaceService.hasEnoughSpace(file.size);
    if (!hasSpace) {
      throw new HttpException(
        'Espacio en disco insuficiente. Contacte al administrador.',
        507,
      );
    }

    // Apply watermark if enabled
    let fileBuffer = file.buffer;
    let hasWatermark = false;

    const watermarkEnabled =
      await this.watermarkService.isWatermarkEnabled();
    if (watermarkEnabled) {
      if (category === 'image') {
        fileBuffer = await this.watermarkService.applyImageWatermark(
          file.buffer,
          { patientId },
        );
        hasWatermark = true;
      }
      // Video watermarking is handled differently (requires file paths via ffmpeg).
      // The video is stored first, then watermarked in-place.
    }

    const user = (req as any).user as JwtPayload;

    const result = await this.fileService.upload(
      patientId,
      fileBuffer,
      {
        originalName: file.originalname,
        mimeType: file.mimetype,
        captureDate: captureDate || undefined,
        anatomicalZone: anatomicalZone || undefined,
        notes: notes || undefined,
      },
      user.sub,
    );

    // Update watermark flag if it was applied
    if (hasWatermark) {
      await this.prisma.fileMetadata.update({
        where: { id: result.id },
        data: { hasWatermark: true },
      });
    }

    // Apply video watermark post-upload (ffmpeg requires file paths)
    if (watermarkEnabled && category === 'video') {
      try {
        const pathModule = await import('path');
        const fsModule = await import('fs/promises');
        const baseStoragePath =
          this.configService.get<string>('FILE_STORAGE_PATH') ||
          '/data/clinic-files';
        const videoPath = pathModule.join(baseStoragePath, result.storagePath);
        const tempOutputPath = videoPath + '.watermarked.tmp';

        await this.watermarkService.applyVideoWatermark(
          videoPath,
          tempOutputPath,
          { patientId },
        );

        // Replace original with watermarked version
        await fsModule.rename(tempOutputPath, videoPath);
        hasWatermark = true;

        await this.prisma.fileMetadata.update({
          where: { id: result.id },
          data: { hasWatermark: true },
        });
      } catch {
        // If video watermark fails, keep the original file without watermark
      }
    }

    return {
      message: 'Archivo multimedia subido exitosamente',
      data: {
        id: result.id,
        patientId: result.patientId,
        originalName: result.originalName,
        uniqueName: result.uniqueName,
        mimeType: result.mimeType,
        sizeBytes: result.sizeBytes.toString(),
        category: result.category,
        captureDate,
        anatomicalZone,
        notes,
        hasWatermark,
        uploadedAt: result.uploadedAt,
      },
    };
  }

  /**
   * GET /patients/:patientId/gallery
   * Returns the multimedia timeline for a patient, ordered by captureDate DESC
   * (falls back to uploadedAt if no captureDate).
   *
   * @validates Requirements 3.2
   */
  @Get('gallery')
  async listGallery(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query('page') page?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limit = DOCUMENTS_PAGE_SIZE;
    const skip = (pageNum - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.fileMetadata.findMany({
        where: {
          patientId,
          category: { in: ['image', 'video'] },
        },
        orderBy: [
          { captureDate: 'desc' },
          { uploadedAt: 'desc' },
        ],
        skip,
        take: limit,
        select: {
          id: true,
          originalName: true,
          uniqueName: true,
          mimeType: true,
          sizeBytes: true,
          category: true,
          captureDate: true,
          anatomicalZone: true,
          notes: true,
          hasWatermark: true,
          uploadedAt: true,
          uploader: {
            select: { id: true, fullName: true },
          },
        },
      }),
      this.prisma.fileMetadata.count({
        where: {
          patientId,
          category: { in: ['image', 'video'] },
        },
      }),
    ]);

    return {
      data: items.map((item) => ({
        ...item,
        sizeBytes: item.sizeBytes.toString(),
      })),
      meta: {
        total,
        page: pageNum,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
