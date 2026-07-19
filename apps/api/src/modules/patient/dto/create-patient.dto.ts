import { CreatePatientInput } from '@historial/validators';

/**
 * DTO for creating a patient.
 * Uses the Zod schema from @historial/validators for validation
 * via a ZodValidationPipe in the controller.
 */
export type CreatePatientDto = CreatePatientInput & {
  /** Optional additional fields not in the shared schema */
  address?: string;
  bloodType?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
};

export type UpdatePatientDto = Partial<CreatePatientDto>;
