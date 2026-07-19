import { z } from 'zod';
/**
 * Schema de validación para datos de paciente.
 * Validates: Requirements 1.3, 1.4, 7.4
 */
/** Sexo biológico del paciente */
export declare const sexoEnum: z.ZodEnum<["M", "F", "O"]>;
/** Validación de alergia individual (max 200 chars) */
export declare const allergySchema: z.ZodString;
/** Validación de cirugía previa */
export declare const previousSurgerySchema: z.ZodObject<{
    name: z.ZodString;
    date: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    name: string;
    date: Date;
}, {
    name: string;
    date: Date;
}>;
/** Validación de foto de perfil */
export declare const profilePhotoSchema: z.ZodObject<{
    mimeType: z.ZodEnum<["image/jpeg", "image/png"]>;
    sizeBytes: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    sizeBytes: number;
    mimeType: "image/jpeg" | "image/png";
}, {
    sizeBytes: number;
    mimeType: "image/jpeg" | "image/png";
}>;
/** Schema principal de paciente */
export declare const patientSchema: z.ZodObject<{
    fullName: z.ZodString;
    birthDate: z.ZodEffects<z.ZodDate, Date, Date>;
    sex: z.ZodEnum<["M", "F", "O"]>;
    phone: z.ZodString;
    email: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    allergies: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    previousSurgeries: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        date: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        name: string;
        date: Date;
    }, {
        name: string;
        date: Date;
    }>, "many">>;
    profilePhoto: z.ZodOptional<z.ZodObject<{
        mimeType: z.ZodEnum<["image/jpeg", "image/png"]>;
        sizeBytes: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        sizeBytes: number;
        mimeType: "image/jpeg" | "image/png";
    }, {
        sizeBytes: number;
        mimeType: "image/jpeg" | "image/png";
    }>>;
}, "strip", z.ZodTypeAny, {
    fullName: string;
    birthDate: Date;
    sex: "M" | "F" | "O";
    phone: string;
    allergies: string[];
    previousSurgeries: {
        name: string;
        date: Date;
    }[];
    email?: string | undefined;
    profilePhoto?: {
        sizeBytes: number;
        mimeType: "image/jpeg" | "image/png";
    } | undefined;
}, {
    fullName: string;
    birthDate: Date;
    sex: "M" | "F" | "O";
    phone: string;
    email?: string | undefined;
    allergies?: string[] | undefined;
    previousSurgeries?: {
        name: string;
        date: Date;
    }[] | undefined;
    profilePhoto?: {
        sizeBytes: number;
        mimeType: "image/jpeg" | "image/png";
    } | undefined;
}>;
/** Schema para creación de paciente (todos los campos obligatorios presentes) */
export declare const createPatientSchema: z.ZodObject<{
    fullName: z.ZodString;
    birthDate: z.ZodEffects<z.ZodDate, Date, Date>;
    sex: z.ZodEnum<["M", "F", "O"]>;
    phone: z.ZodString;
    email: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    allergies: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    previousSurgeries: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        date: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        name: string;
        date: Date;
    }, {
        name: string;
        date: Date;
    }>, "many">>;
    profilePhoto: z.ZodOptional<z.ZodObject<{
        mimeType: z.ZodEnum<["image/jpeg", "image/png"]>;
        sizeBytes: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        sizeBytes: number;
        mimeType: "image/jpeg" | "image/png";
    }, {
        sizeBytes: number;
        mimeType: "image/jpeg" | "image/png";
    }>>;
}, "strip", z.ZodTypeAny, {
    fullName: string;
    birthDate: Date;
    sex: "M" | "F" | "O";
    phone: string;
    allergies: string[];
    previousSurgeries: {
        name: string;
        date: Date;
    }[];
    email?: string | undefined;
    profilePhoto?: {
        sizeBytes: number;
        mimeType: "image/jpeg" | "image/png";
    } | undefined;
}, {
    fullName: string;
    birthDate: Date;
    sex: "M" | "F" | "O";
    phone: string;
    email?: string | undefined;
    allergies?: string[] | undefined;
    previousSurgeries?: {
        name: string;
        date: Date;
    }[] | undefined;
    profilePhoto?: {
        sizeBytes: number;
        mimeType: "image/jpeg" | "image/png";
    } | undefined;
}>;
/** Schema para actualización parcial de paciente */
export declare const updatePatientSchema: z.ZodObject<{
    fullName: z.ZodOptional<z.ZodString>;
    birthDate: z.ZodOptional<z.ZodEffects<z.ZodDate, Date, Date>>;
    sex: z.ZodOptional<z.ZodEnum<["M", "F", "O"]>>;
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>>;
    allergies: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    previousSurgeries: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        date: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        name: string;
        date: Date;
    }, {
        name: string;
        date: Date;
    }>, "many">>>;
    profilePhoto: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        mimeType: z.ZodEnum<["image/jpeg", "image/png"]>;
        sizeBytes: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        sizeBytes: number;
        mimeType: "image/jpeg" | "image/png";
    }, {
        sizeBytes: number;
        mimeType: "image/jpeg" | "image/png";
    }>>>;
}, "strip", z.ZodTypeAny, {
    fullName?: string | undefined;
    birthDate?: Date | undefined;
    sex?: "M" | "F" | "O" | undefined;
    phone?: string | undefined;
    email?: string | undefined;
    allergies?: string[] | undefined;
    previousSurgeries?: {
        name: string;
        date: Date;
    }[] | undefined;
    profilePhoto?: {
        sizeBytes: number;
        mimeType: "image/jpeg" | "image/png";
    } | undefined;
}, {
    fullName?: string | undefined;
    birthDate?: Date | undefined;
    sex?: "M" | "F" | "O" | undefined;
    phone?: string | undefined;
    email?: string | undefined;
    allergies?: string[] | undefined;
    previousSurgeries?: {
        name: string;
        date: Date;
    }[] | undefined;
    profilePhoto?: {
        sizeBytes: number;
        mimeType: "image/jpeg" | "image/png";
    } | undefined;
}>;
/** Tipos inferidos */
export type PatientInput = z.infer<typeof patientSchema>;
export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type ProfilePhotoInput = z.infer<typeof profilePhotoSchema>;
export type PreviousSurgeryInput = z.infer<typeof previousSurgerySchema>;
//# sourceMappingURL=patient.schema.d.ts.map