/**
 * Tipos relacionados con la configuración de clínica y tema white-label.
 * @validates Requirements 10.1
 */

/** Configuración de tema white-label */
export interface ThemeConfig {
  clinicName: string;
  logoUrl: string;
  primaryColor: string;          // hex (#RRGGBB)
  secondaryColor: string;        // hex (#RRGGBB)
  accentColor: string;           // hex (#RRGGBB)
  fontFamily: string;
  darkMode: boolean;
}

/** Configuración de coordenadas para inyección de datos en PDF */
export interface LetterheadFieldConfig {
  x: number;
  y: number;
  fontSize: number;
  font: string;
  maxWidth?: number;
  lineHeight?: number;
}

/** Configuración de membrete completo */
export interface LetterheadConfig {
  pageSize: string;
  margins: { top: number; right: number; bottom: number; left: number };
  fields: {
    patientName: LetterheadFieldConfig;
    date: LetterheadFieldConfig;
    content: LetterheadFieldConfig;
    doctorSignature: LetterheadFieldConfig;
    footer: LetterheadFieldConfig;
  };
  templatePdfPath: string;
}

/** Clínica */
export interface Clinic {
  id: string;
  name: string;
  address: string;
  phone: string;
  privacyNotice?: Record<string, unknown> | null;
  letterheadConfig?: LetterheadConfig | null;
  createdAt: string;             // ISO 8601
}
