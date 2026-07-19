import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import * as path from 'path';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Options for applying watermark to images and videos.
 */
export interface WatermarkOptions {
  patientId: string;
  clinicLogoPath?: string;
  opacity?: number; // 0-1, default 0.5
}

/**
 * WatermarkService applies clinic logo + patient ID watermark
 * over images (using sharp) and videos (using ffmpeg).
 *
 * Requirements: 3.4 — WHILE la opción de Marca_Agua está habilitada,
 * aplicar automáticamente la Marca_Agua (logo de clínica + ID de paciente)
 * sobre el archivo antes de almacenarlo.
 */
@Injectable()
export class WatermarkService {
  private readonly logger = new Logger(WatermarkService.name);
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
   * Applies watermark to an image buffer using sharp.
   * Composites clinic logo at bottom-right and adds patient ID as text overlay
   * via SVG rendered through sharp.
   *
   * @param inputBuffer - The original image buffer
   * @param options - Watermark options (patientId, logo path, opacity)
   * @returns Watermarked image buffer
   */
  async applyImageWatermark(
    inputBuffer: Buffer,
    options: WatermarkOptions,
  ): Promise<Buffer> {
    const sharp = (await import('sharp')).default;

    const opacity = options.opacity ?? 0.5;
    const compositeInputs: Array<{
      input: Buffer;
      gravity?: string;
      top?: number;
      left?: number;
    }> = [];

    // Get image metadata for positioning
    const imageMetadata = await sharp(inputBuffer).metadata();
    const imgWidth = imageMetadata.width || 800;
    const imgHeight = imageMetadata.height || 600;

    // 1. Add clinic logo at bottom-right corner (if available)
    const logoPath = options.clinicLogoPath || (await this.getLogoPath());
    if (logoPath) {
      try {
        await fs.access(logoPath);
        const logoBuffer = await fs.readFile(logoPath);

        // Resize logo to a reasonable size (max 15% of image width)
        const maxLogoWidth = Math.round(imgWidth * 0.15);
        const maxLogoHeight = Math.round(imgHeight * 0.1);

        const resizedLogo = await sharp(logoBuffer)
          .resize(maxLogoWidth, maxLogoHeight, { fit: 'inside' })
          .ensureAlpha()
          .composite([
            {
              input: Buffer.from(
                `<svg width="${maxLogoWidth}" height="${maxLogoHeight}"><rect x="0" y="0" width="${maxLogoWidth}" height="${maxLogoHeight}" fill="white" fill-opacity="${opacity}"/></svg>`,
              ),
              blend: 'dest-in' as const,
            },
          ])
          .toBuffer();

        const logoMeta = await sharp(resizedLogo).metadata();
        const logoW = logoMeta.width || maxLogoWidth;
        const logoH = logoMeta.height || maxLogoHeight;

        // Position at bottom-right with padding
        const padding = 10;
        compositeInputs.push({
          input: resizedLogo,
          top: imgHeight - logoH - padding,
          left: imgWidth - logoW - padding,
        });
      } catch (err: unknown) {
        const error = err as Error;
        this.logger.warn(
          `Could not load clinic logo for watermark: ${error.message}`,
        );
      }
    }

    // 2. Add patient ID as text overlay using SVG
    const textSvg = this.createTextSvg(options.patientId, imgWidth, opacity);
    compositeInputs.push({
      input: Buffer.from(textSvg),
      gravity: 'southwest',
    });

    // Apply composites to the original image
    if (compositeInputs.length === 0) {
      return inputBuffer;
    }

    try {
      const result = await sharp(inputBuffer)
        .composite(
          compositeInputs.map((item) => ({
            input: item.input,
            ...(item.gravity ? { gravity: item.gravity as any } : {}),
            ...(item.top !== undefined ? { top: item.top } : {}),
            ...(item.left !== undefined ? { left: item.left } : {}),
          })),
        )
        .toBuffer();

      return result;
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `Error applying image watermark: ${error.message}`,
        error.stack,
      );
      // Return original image if watermarking fails
      return inputBuffer;
    }
  }

  /**
   * Applies watermark to a video file using ffmpeg.
   * Adds clinic logo overlay at bottom-right and patient ID text using drawtext filter.
   *
   * Note: ffmpeg must be installed on the server. If unavailable, a warning is logged
   * and the watermark step is skipped gracefully (file is copied as-is).
   *
   * @param inputPath - Path to the original video file
   * @param outputPath - Path where watermarked video will be saved
   * @param options - Watermark options (patientId, logo path, opacity)
   */
  async applyVideoWatermark(
    inputPath: string,
    outputPath: string,
    options: WatermarkOptions,
  ): Promise<void> {
    // Check ffmpeg availability
    const ffmpegAvailable = await this.isFfmpegAvailable();
    if (!ffmpegAvailable) {
      this.logger.warn(
        'ffmpeg is not available on this server. Video watermark will be skipped.',
      );
      // Copy file as-is when ffmpeg is not available
      await fs.copyFile(inputPath, outputPath);
      return;
    }

    const opacity = options.opacity ?? 0.5;
    const logoPath = options.clinicLogoPath || (await this.getLogoPath());

    // Build ffmpeg filter complex
    const filters: string[] = [];
    let inputArgs = `-i "${inputPath}"`;
    let filterComplex = '';

    if (logoPath) {
      try {
        await fs.access(logoPath);
        inputArgs += ` -i "${logoPath}"`;

        // Overlay logo at bottom-right with opacity
        filters.push(
          `[1:v]format=rgba,colorchannelmixer=aa=${opacity}[logo]`,
        );
        filters.push(`[0:v][logo]overlay=W-w-10:H-h-10[withlogo]`);

        // Add patient ID text on top of the logo overlay
        const escapedPatientId = this.escapeForFfmpeg(options.patientId);
        filters.push(
          `[withlogo]drawtext=text='ID\\: ${escapedPatientId}':fontsize=18:fontcolor=white@${opacity}:x=10:y=H-th-10[out]`,
        );
        filterComplex = `-filter_complex "${filters.join(';')}" -map "[out]" -map 0:a?`;
      } catch {
        // Logo not accessible, use text-only watermark
        const escapedPatientId = this.escapeForFfmpeg(options.patientId);
        filterComplex = `-vf "drawtext=text='ID\\: ${escapedPatientId}':fontsize=18:fontcolor=white@${opacity}:x=10:y=H-th-10"`;
      }
    } else {
      // No logo, use text-only watermark
      const escapedPatientId = this.escapeForFfmpeg(options.patientId);
      filterComplex = `-vf "drawtext=text='ID\\: ${escapedPatientId}':fontsize=18:fontcolor=white@${opacity}:x=10:y=H-th-10"`;
    }

    const command = `ffmpeg -y ${inputArgs} ${filterComplex} -codec:a copy "${outputPath}"`;

    try {
      await execAsync(command, { timeout: 120000 }); // 2 minute timeout
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`ffmpeg watermark failed: ${error.message}`);
      // Graceful fallback: copy original without watermark
      this.logger.warn(
        'Falling back to original video without watermark.',
      );
      await fs.copyFile(inputPath, outputPath);
    }
  }

  /**
   * Checks if watermark is enabled in the clinic configuration.
   * Looks for watermarkEnabled flag in the clinic's theme rawConfig JSON field.
   *
   * @returns true if watermark should be applied, false otherwise
   */
  async isWatermarkEnabled(): Promise<boolean> {
    try {
      const themeConfig = await this.prisma.themeConfig.findFirst({
        select: { rawConfig: true },
      });

      if (!themeConfig || !themeConfig.rawConfig) {
        return false;
      }

      const rawConfig = themeConfig.rawConfig as Record<string, unknown>;
      return rawConfig.watermarkEnabled === true;
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.warn(
        `Error checking watermark configuration: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Gets the clinic's logo path from the theme configuration.
   *
   * @returns The absolute path to the logo file, or null if no logo configured
   */
  async getLogoPath(): Promise<string | null> {
    try {
      const themeConfig = await this.prisma.themeConfig.findFirst({
        select: { logoPath: true },
      });

      if (!themeConfig || !themeConfig.logoPath) {
        return null;
      }

      const logoPath = themeConfig.logoPath;

      // If the path is relative, resolve it against the base storage path
      if (path.isAbsolute(logoPath)) {
        return logoPath;
      }

      return path.join(this.baseStoragePath, logoPath);
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.warn(`Error retrieving logo path: ${error.message}`);
      return null;
    }
  }

  /**
   * Creates an SVG text element for the patient ID watermark.
   * The text is rendered semi-transparent at the bottom-left of the image.
   */
  private createTextSvg(
    patientId: string,
    imageWidth: number,
    opacity: number,
  ): string {
    const fontSize = Math.max(14, Math.round(imageWidth * 0.02));
    const padding = 10;
    const textHeight = fontSize + padding * 2;

    return `<svg width="${imageWidth}" height="${textHeight}">
      <text
        x="${padding}"
        y="${fontSize + padding / 2}"
        font-family="Arial, sans-serif"
        font-size="${fontSize}"
        fill="white"
        fill-opacity="${opacity}"
        stroke="black"
        stroke-opacity="${opacity * 0.5}"
        stroke-width="0.5"
      >ID: ${this.escapeXml(patientId)}</text>
    </svg>`;
  }

  /**
   * Escapes special XML characters in a string.
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Escapes a string for use in ffmpeg filter expressions.
   */
  private escapeForFfmpeg(str: string): string {
    return str.replace(/'/g, "\\'").replace(/:/g, '\\:');
  }

  /**
   * Checks if ffmpeg is available on the system.
   */
  private async isFfmpegAvailable(): Promise<boolean> {
    try {
      await execAsync('ffmpeg -version');
      return true;
    } catch {
      return false;
    }
  }
}
