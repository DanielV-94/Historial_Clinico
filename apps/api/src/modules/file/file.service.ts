import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  fileValidationSchema,
  getCategoryFromMime,
  type FileCategory,
} from '@historial/validators';
import { PrismaService } from '../../database/prisma.service';
import { UploadFileDto } from './dto/upload-file.dto';

/** Result of file validation */
export interface FileValidationResult {
  valid: boolean;
  errors?: Array<{ field: string; message: string }>;
}

/** Result of duplicate name check */
export interface DuplicateNameResult {
  isDuplicate: boolean;
  existingFile?: {
    id: string;
    originalName: string;
    uniqueName: string;
    uploadedAt: Date;
  };
}

/** Metadata returned after successful upload */
export interface UploadResult {
  id: string;
  patientId: string;
  originalName: string;
  uniqueName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: bigint;
  checksum: string;
  category: FileCategory;
  studyType: string | null;
  uploadedAt: Date;
}

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);
  private readonly baseStoragePath: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.baseStoragePath =
      this.configService.get<string>('FILE_STORAGE_PATH') ||
      '/data/clinic-files';
  }

  /**
   * Validates a file based on MIME type, size per category, and SHA-256 checksum.
   * Uses fileValidationSchema from @historial/validators for composed validation.
   *
   * Requirements: 2.4, 3.5, 3.6, 12.3, 12.5
   */
  validateFile(
    mimeType: string,
    sizeBytes: number,
    checksum: string,
  ): FileValidationResult {
    const result = fileValidationSchema.safeParse({
      mimeType,
      sizeBytes,
      checksum,
    });

    if (result.success) {
      return { valid: true };
    }

    const errors = result.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    return { valid: false, errors };
  }

  /**
   * Computes SHA-256 checksum for a file buffer.
   */
  computeChecksum(fileBuffer: Buffer): string {
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * Uploads a file for a patient:
   * 1. Validates MIME + size + checksum
   * 2. Determines category from MIME
   * 3. Generates unique name: {YYYY-MM-DD}_{studyType}_{uuid-short}.{ext}
   * 4. Builds storage path: {BASE_PATH}/patients/{patientId}/{category}/
   * 5. Checks for duplicate name in same category/patient
   * 6. Writes file to disk
   * 7. Stores metadata in DB via Prisma
   *
   * Requirements: 2.1, 3.1, 12.1, 12.2, 12.3
   */
  async upload(
    patientId: string,
    fileBuffer: Buffer,
    metadata: UploadFileDto,
    userId: string,
  ): Promise<UploadResult> {
    const sizeBytes = fileBuffer.length;
    const checksum = this.computeChecksum(fileBuffer);

    // Step 1: Validate MIME + size + checksum
    const validation = this.validateFile(metadata.mimeType, sizeBytes, checksum);
    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Validación de archivo fallida',
        errors: validation.errors,
      });
    }

    // Step 2: Determine category from MIME
    const category = getCategoryFromMime(metadata.mimeType);
    if (!category) {
      throw new BadRequestException({
        message: `Tipo MIME no soportado: ${metadata.mimeType}`,
      });
    }

    // Step 3: Generate unique name
    const uniqueName = this.generateUniqueName(
      metadata.originalName,
      metadata.studyType,
    );

    // Step 4: Build storage path
    const storagePath = this.buildStoragePath(patientId, category);

    // Step 5: Check for duplicate name
    const duplicateCheck = await this.checkDuplicateName(
      patientId,
      category,
      metadata.originalName,
    );
    if (duplicateCheck.isDuplicate) {
      throw new BadRequestException({
        message: `Ya existe un archivo con el nombre "${metadata.originalName}" en la misma categoría para este paciente`,
        existingFile: duplicateCheck.existingFile,
        code: 'DUPLICATE_FILE_NAME',
      });
    }

    // Step 6: Write file to disk
    const fullDirectoryPath = path.join(this.baseStoragePath, storagePath);
    const fullFilePath = path.join(fullDirectoryPath, uniqueName);

    try {
      await fs.mkdir(fullDirectoryPath, { recursive: true });
      await fs.writeFile(fullFilePath, fileBuffer);
    } catch (err: unknown) {
      const error = err as Error & { code?: string };
      this.logger.error(
        `Error writing file to disk: ${error.message}`,
        error.stack,
      );
      // Clean up partial file if it was created
      try {
        await fs.unlink(fullFilePath);
      } catch {
        // File may not exist, ignore cleanup error
      }
      throw new BadRequestException({
        message:
          'No se pudo completar la subida del archivo. Verifique el espacio en disco.',
      });
    }

    // Step 7: Store metadata in DB
    const fileRecord = await this.prisma.fileMetadata.create({
      data: {
        patientId,
        uploadedBy: userId,
        originalName: metadata.originalName,
        uniqueName,
        storagePath: path.join(storagePath, uniqueName),
        mimeType: metadata.mimeType,
        sizeBytes: BigInt(sizeBytes),
        checksum,
        category: category as any,
        studyType: metadata.studyType || null,
        captureDate: metadata.captureDate
          ? new Date(metadata.captureDate)
          : null,
        anatomicalZone: metadata.anatomicalZone || null,
        notes: metadata.notes || null,
      },
    });

    return {
      id: fileRecord.id,
      patientId: fileRecord.patientId,
      originalName: fileRecord.originalName,
      uniqueName: fileRecord.uniqueName,
      storagePath: fileRecord.storagePath,
      mimeType: fileRecord.mimeType,
      sizeBytes: fileRecord.sizeBytes,
      checksum: fileRecord.checksum,
      category: category,
      studyType: fileRecord.studyType,
      uploadedAt: fileRecord.uploadedAt,
    };
  }

  /**
   * Finds file metadata and returns the full path for streaming/download.
   *
   * Requirements: 2.2
   */
  async download(
    patientId: string,
    fileId: string,
  ): Promise<{ filePath: string; metadata: any }> {
    const fileRecord = await this.prisma.fileMetadata.findFirst({
      where: {
        id: fileId,
        patientId,
      },
    });

    if (!fileRecord) {
      throw new NotFoundException(
        `Archivo con ID ${fileId} no encontrado para el paciente ${patientId}`,
      );
    }

    const fullPath = path.join(this.baseStoragePath, fileRecord.storagePath);

    // Verify file exists on disk
    try {
      await fs.access(fullPath);
    } catch {
      throw new NotFoundException(
        'El archivo no se encuentra en el sistema de archivos',
      );
    }

    return {
      filePath: fullPath,
      metadata: fileRecord,
    };
  }

  /**
   * Deletes a file from both disk and database.
   *
   * Requirements: 2.5
   */
  async delete(patientId: string, fileId: string): Promise<void> {
    const fileRecord = await this.prisma.fileMetadata.findFirst({
      where: {
        id: fileId,
        patientId,
      },
    });

    if (!fileRecord) {
      throw new NotFoundException(
        `Archivo con ID ${fileId} no encontrado para el paciente ${patientId}`,
      );
    }

    const fullPath = path.join(this.baseStoragePath, fileRecord.storagePath);

    // Delete file from disk
    try {
      await fs.unlink(fullPath);
    } catch (err: unknown) {
      const error = err as Error & { code?: string };
      // Log but don't fail if file already doesn't exist on disk
      if (error.code !== 'ENOENT') {
        this.logger.warn(
          `Could not delete file from disk: ${fullPath} - ${error.message}`,
        );
      }
    }

    // Delete record from DB
    await this.prisma.fileMetadata.delete({
      where: { id: fileId },
    });
  }

  /**
   * Checks if a file with the same original name already exists
   * in the same category for the same patient.
   *
   * Requirements: 2.6
   */
  async checkDuplicateName(
    patientId: string,
    category: string,
    originalName: string,
  ): Promise<DuplicateNameResult> {
    const existing = await this.prisma.fileMetadata.findFirst({
      where: {
        patientId,
        category: category as any,
        originalName,
      },
      select: {
        id: true,
        originalName: true,
        uniqueName: true,
        uploadedAt: true,
      },
    });

    if (existing) {
      return {
        isDuplicate: true,
        existingFile: existing,
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Generates a unique file name following the convention:
   * {YYYY-MM-DD}_{study-type}_{uuid-short}.{ext}
   *
   * Example: 2024-03-15_radiografia-torax_a1b2c3.pdf
   */
  generateUniqueName(originalName: string, studyType?: string): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const ext = path.extname(originalName).toLowerCase();
    const uuidShort = crypto.randomUUID().slice(0, 8);

    // Normalize study type: lowercase, replace spaces with hyphens, remove special chars
    const typePart = studyType
      ? this.normalizeForFilename(studyType)
      : 'archivo';

    return `${datePart}_${typePart}_${uuidShort}${ext}`;
  }

  /**
   * Builds the storage path for a patient's file based on category.
   * Pattern: patients/{patientId}/{category}/
   *
   * Category mapping:
   * - pdf → documents/
   * - image → gallery/images/
   * - video → gallery/videos/
   */
  buildStoragePath(patientId: string, category: FileCategory): string {
    const categoryFolders: Record<FileCategory, string> = {
      pdf: 'documents',
      image: 'gallery/images',
      video: 'gallery/videos',
    };

    const folder = categoryFolders[category];
    return path.join('patients', patientId, folder);
  }

  /**
   * Normalizes a string for use in filenames:
   * - Lowercase
   * - Replace spaces/special chars with hyphens
   * - Remove consecutive hyphens
   * - Trim hyphens from edges
   */
  private normalizeForFilename(input: string): string {
    return input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/-+/g, '-') // Collapse consecutive hyphens
      .replace(/^-|-$/g, ''); // Trim leading/trailing hyphens
  }
}
