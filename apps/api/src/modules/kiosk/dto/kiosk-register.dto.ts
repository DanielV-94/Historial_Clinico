import { CreatePatientInput } from '@historial/validators';

/**
 * DTO for kiosk patient registration.
 * Extends the shared patient input with additional fields for kiosk flow:
 * - Emergency contact info
 * - Signature image (base64 PNG)
 *
 * Validates: Requirements 7.1, 7.2, 7.4
 */
export interface KioskRegisterDto extends CreatePatientInput {
  /** Emergency contact full name */
  emergencyContactName?: string;
  /** Emergency contact phone number */
  emergencyContactPhone?: string;
  /** Relationship to the patient */
  emergencyContactRelation?: string;
  /** Patient address */
  address?: string;
  /** Blood type */
  bloodType?: string;
  /** Insurance provider name */
  insuranceProvider?: string;
  /** Insurance policy number */
  insurancePolicyNumber?: string;
  /** Digital signature as base64-encoded PNG image */
  signatureImage: string;
}
