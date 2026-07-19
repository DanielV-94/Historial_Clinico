import { z } from 'zod';
/** Schema para color hexadecimal */
export declare const hexColorSchema: z.ZodString;
/** MIME types permitidos para logo */
export declare const LOGO_ALLOWED_MIME_TYPES: readonly ["image/png", "image/svg+xml"];
/** Tamaño máximo del logo: 2 MB */
export declare const LOGO_MAX_SIZE: number;
/** Schema de validación del logo */
export declare const logoSchema: z.ZodObject<{
    mimeType: z.ZodEnum<["image/png", "image/svg+xml"]>;
    sizeBytes: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    sizeBytes: number;
    mimeType: "image/png" | "image/svg+xml";
}, {
    sizeBytes: number;
    mimeType: "image/png" | "image/svg+xml";
}>;
/** Schema completo de configuración de tema */
export declare const themeConfigSchema: z.ZodObject<{
    clinicName: z.ZodString;
    primaryColor: z.ZodString;
    secondaryColor: z.ZodString;
    accentColor: z.ZodString;
    fontFamily: z.ZodString;
    logo: z.ZodOptional<z.ZodObject<{
        mimeType: z.ZodEnum<["image/png", "image/svg+xml"]>;
        sizeBytes: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        sizeBytes: number;
        mimeType: "image/png" | "image/svg+xml";
    }, {
        sizeBytes: number;
        mimeType: "image/png" | "image/svg+xml";
    }>>;
}, "strip", z.ZodTypeAny, {
    clinicName: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    fontFamily: string;
    logo?: {
        sizeBytes: number;
        mimeType: "image/png" | "image/svg+xml";
    } | undefined;
}, {
    clinicName: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    fontFamily: string;
    logo?: {
        sizeBytes: number;
        mimeType: "image/png" | "image/svg+xml";
    } | undefined;
}>;
/** Valores por defecto del tema */
export declare const DEFAULT_THEME: {
    readonly clinicName: "Clínica";
    readonly primaryColor: "#2563EB";
    readonly secondaryColor: "#1E40AF";
    readonly accentColor: "#3B82F6";
    readonly fontFamily: "Inter";
};
/** Tipos inferidos */
export type ThemeConfigInput = z.infer<typeof themeConfigSchema>;
export type LogoInput = z.infer<typeof logoSchema>;
export type HexColor = z.infer<typeof hexColorSchema>;
//# sourceMappingURL=theme.schema.d.ts.map