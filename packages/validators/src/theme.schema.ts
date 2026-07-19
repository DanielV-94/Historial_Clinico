import { z } from 'zod';

/**
 * Schema de validación para configuración de tema (white-label).
 * Validates: Requirements 10.1, 10.4
 */

/** Regex para color hexadecimal #RRGGBB */
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

/** Schema para color hexadecimal */
export const hexColorSchema = z
  .string()
  .regex(HEX_COLOR_REGEX, 'El color debe tener formato hexadecimal válido (#RRGGBB)');

/** MIME types permitidos para logo */
export const LOGO_ALLOWED_MIME_TYPES = ['image/png', 'image/svg+xml'] as const;

/** Tamaño máximo del logo: 2 MB */
export const LOGO_MAX_SIZE = 2 * 1024 * 1024;

/** Schema de validación del logo */
export const logoSchema = z.object({
  mimeType: z.enum(LOGO_ALLOWED_MIME_TYPES, {
    errorMap: () => ({ message: 'El logo debe ser PNG o SVG' }),
  }),
  sizeBytes: z
    .number()
    .positive('El tamaño del logo debe ser mayor a 0')
    .max(LOGO_MAX_SIZE, 'El logo no puede exceder 2 MB'),
});

/** Schema completo de configuración de tema */
export const themeConfigSchema = z.object({
  clinicName: z
    .string({ required_error: 'El nombre de la clínica es obligatorio' })
    .min(1, 'El nombre de la clínica no puede estar vacío'),

  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema,
  accentColor: hexColorSchema,

  fontFamily: z
    .string({ required_error: 'La familia tipográfica es obligatoria' })
    .min(1, 'La familia tipográfica no puede estar vacía'),

  logo: logoSchema.optional(),
});

/** Valores por defecto del tema */
export const DEFAULT_THEME = {
  clinicName: 'Clínica',
  primaryColor: '#2563EB',
  secondaryColor: '#1E40AF',
  accentColor: '#3B82F6',
  fontFamily: 'Inter',
} as const;

/** Tipos inferidos */
export type ThemeConfigInput = z.infer<typeof themeConfigSchema>;
export type LogoInput = z.infer<typeof logoSchema>;
export type HexColor = z.infer<typeof hexColorSchema>;
