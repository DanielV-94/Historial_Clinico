import { describe, it, expect } from 'vitest';
import { themeConfigSchema, hexColorSchema, logoSchema } from './theme.schema';

describe('hexColorSchema', () => {
  it('acepta color hexadecimal válido', () => {
    expect(hexColorSchema.safeParse('#FF5733').success).toBe(true);
    expect(hexColorSchema.safeParse('#000000').success).toBe(true);
    expect(hexColorSchema.safeParse('#ffffff').success).toBe(true);
  });

  it('rechaza color sin #', () => {
    expect(hexColorSchema.safeParse('FF5733').success).toBe(false);
  });

  it('rechaza color con longitud incorrecta', () => {
    expect(hexColorSchema.safeParse('#FFF').success).toBe(false);
    expect(hexColorSchema.safeParse('#FFFFFFF').success).toBe(false);
  });

  it('rechaza caracteres no hexadecimales', () => {
    expect(hexColorSchema.safeParse('#GGGGGG').success).toBe(false);
  });
});

describe('logoSchema', () => {
  it('acepta logo PNG dentro del límite', () => {
    const result = logoSchema.safeParse({
      mimeType: 'image/png',
      sizeBytes: 1 * 1024 * 1024,
    });
    expect(result.success).toBe(true);
  });

  it('acepta logo SVG dentro del límite', () => {
    const result = logoSchema.safeParse({
      mimeType: 'image/svg+xml',
      sizeBytes: 50 * 1024,
    });
    expect(result.success).toBe(true);
  });

  it('rechaza logo JPEG', () => {
    const result = logoSchema.safeParse({
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza logo mayor a 2MB', () => {
    const result = logoSchema.safeParse({
      mimeType: 'image/png',
      sizeBytes: 3 * 1024 * 1024,
    });
    expect(result.success).toBe(false);
  });
});

describe('themeConfigSchema', () => {
  const validTheme = {
    clinicName: 'Mi Clínica',
    primaryColor: '#2563EB',
    secondaryColor: '#1E40AF',
    accentColor: '#3B82F6',
    fontFamily: 'Inter',
  };

  it('acepta tema completo válido', () => {
    const result = themeConfigSchema.safeParse(validTheme);
    expect(result.success).toBe(true);
  });

  it('acepta tema con logo opcional', () => {
    const result = themeConfigSchema.safeParse({
      ...validTheme,
      logo: { mimeType: 'image/png', sizeBytes: 500_000 },
    });
    expect(result.success).toBe(true);
  });

  it('rechaza clinicName vacío', () => {
    const result = themeConfigSchema.safeParse({ ...validTheme, clinicName: '' });
    expect(result.success).toBe(false);
  });

  it('rechaza color primario inválido', () => {
    const result = themeConfigSchema.safeParse({ ...validTheme, primaryColor: 'red' });
    expect(result.success).toBe(false);
  });

  it('rechaza fontFamily vacío', () => {
    const result = themeConfigSchema.safeParse({ ...validTheme, fontFamily: '' });
    expect(result.success).toBe(false);
  });
});
