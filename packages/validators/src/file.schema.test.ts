import { describe, it, expect } from 'vitest';
import {
  fileValidationSchema,
  getCategoryFromMime,
  getSizeLimitForMime,
  FILE_SIZE_LIMITS,
} from './file.schema';

describe('fileValidationSchema', () => {
  const validChecksum = 'a'.repeat(64);

  it('acepta un PDF válido dentro del límite', () => {
    const result = fileValidationSchema.safeParse({
      mimeType: 'application/pdf',
      sizeBytes: 10 * 1024 * 1024,
      checksum: validChecksum,
    });
    expect(result.success).toBe(true);
  });

  it('acepta imagen JPEG válida', () => {
    const result = fileValidationSchema.safeParse({
      mimeType: 'image/jpeg',
      sizeBytes: 30 * 1024 * 1024,
      checksum: validChecksum,
    });
    expect(result.success).toBe(true);
  });

  it('acepta video MP4 válido', () => {
    const result = fileValidationSchema.safeParse({
      mimeType: 'video/mp4',
      sizeBytes: 150 * 1024 * 1024,
      checksum: validChecksum,
    });
    expect(result.success).toBe(true);
  });

  it('rechaza MIME type no permitido', () => {
    const result = fileValidationSchema.safeParse({
      mimeType: 'application/exe',
      sizeBytes: 1024,
      checksum: validChecksum,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza PDF mayor a 20MB', () => {
    const result = fileValidationSchema.safeParse({
      mimeType: 'application/pdf',
      sizeBytes: 21 * 1024 * 1024,
      checksum: validChecksum,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza imagen mayor a 50MB', () => {
    const result = fileValidationSchema.safeParse({
      mimeType: 'image/png',
      sizeBytes: 51 * 1024 * 1024,
      checksum: validChecksum,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza video mayor a 200MB', () => {
    const result = fileValidationSchema.safeParse({
      mimeType: 'video/quicktime',
      sizeBytes: 201 * 1024 * 1024,
      checksum: validChecksum,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza checksum inválido', () => {
    const result = fileValidationSchema.safeParse({
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      checksum: 'not-a-valid-sha256',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza checksum con longitud incorrecta', () => {
    const result = fileValidationSchema.safeParse({
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      checksum: 'abc123',
    });
    expect(result.success).toBe(false);
  });
});

describe('getCategoryFromMime', () => {
  it('retorna pdf para application/pdf', () => {
    expect(getCategoryFromMime('application/pdf')).toBe('pdf');
  });

  it('retorna image para image/jpeg', () => {
    expect(getCategoryFromMime('image/jpeg')).toBe('image');
  });

  it('retorna image para image/heic', () => {
    expect(getCategoryFromMime('image/heic')).toBe('image');
  });

  it('retorna video para video/mp4', () => {
    expect(getCategoryFromMime('video/mp4')).toBe('video');
  });

  it('retorna null para MIME no permitido', () => {
    expect(getCategoryFromMime('application/zip')).toBeNull();
  });
});

describe('getSizeLimitForMime', () => {
  it('retorna 20MB para PDF', () => {
    expect(getSizeLimitForMime('application/pdf')).toBe(FILE_SIZE_LIMITS.pdf);
  });

  it('retorna 50MB para imagen', () => {
    expect(getSizeLimitForMime('image/png')).toBe(FILE_SIZE_LIMITS.image);
  });

  it('retorna 200MB para video', () => {
    expect(getSizeLimitForMime('video/mp4')).toBe(FILE_SIZE_LIMITS.video);
  });

  it('retorna 500MB para MIME desconocido', () => {
    expect(getSizeLimitForMime('unknown/type')).toBe(FILE_SIZE_LIMITS.general);
  });
});
