/**
 * DTO for updating theme configuration.
 * All fields are optional — only provided fields will be updated.
 * Validation is handled by ThemeService using shared Zod validators.
 */
export class UpdateThemeDto {
  clinicName?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  darkMode?: boolean;
}
