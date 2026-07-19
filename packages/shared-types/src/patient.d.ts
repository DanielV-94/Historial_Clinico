/**
 * Tipos relacionados con el perfil del paciente y sus datos clínicos.
 * @validates Requirements 1.1
 */
/** Sexo del paciente */
export type PatientSex = 'M' | 'F' | 'O';
/** Tipo de sangre */
export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
/** Paciente */
export interface Patient {
    id: string;
    fullName: string;
    birthDate: string;
    sex: PatientSex;
    phone: string;
    email?: string | null;
    address?: string | null;
    bloodType?: BloodType | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    emergencyContactRelation?: string | null;
    insuranceProvider?: string | null;
    insurancePolicyNumber?: string | null;
    profilePhotoPath?: string | null;
    createdAt: string;
    updatedAt: string;
}
/** Alergia del paciente (máximo 50 por paciente, 200 caracteres cada una) */
export interface Allergy {
    id: string;
    patientId: string;
    description: string;
    createdAt: string;
}
/** Cirugía previa del paciente (máximo 30 por paciente) */
export interface PreviousSurgery {
    id: string;
    patientId: string;
    name: string;
    surgeryDate: string;
    createdAt: string;
}
//# sourceMappingURL=patient.d.ts.map