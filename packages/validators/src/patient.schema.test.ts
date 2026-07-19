import { describe, it, expect } from 'vitest';
import { patientSchema, profilePhotoSchema } from './patient.schema';

describe('patientSchema', () => {
  const validPatient = {
    fullName: 'Juan Pérez García',
    birthDate: new Date('1990-05-15'),
    sex: 'M' as const,
    phone: '5551234567',
    allergies: ['Penicilina'],
    previousSurgeries: [{ name: 'Apendicectomía', date: new Date('2015-03-10') }],
  };

  it('acepta un paciente con todos los campos válidos', () => {
    const result = patientSchema.safeParse(validPatient);
    expect(result.success).toBe(true);
  });

  it('rechaza nombre vacío', () => {
    const result = patientSchema.safeParse({ ...validPatient, fullName: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('fullName');
    }
  });

  it('rechaza fecha de nacimiento futura', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const result = patientSchema.safeParse({ ...validPatient, birthDate: futureDate });
    expect(result.success).toBe(false);
  });

  it('rechaza sexo inválido', () => {
    const result = patientSchema.safeParse({ ...validPatient, sex: 'X' });
    expect(result.success).toBe(false);
  });

  it('acepta sexo M, F y O', () => {
    for (const sex of ['M', 'F', 'O']) {
      const result = patientSchema.safeParse({ ...validPatient, sex });
      expect(result.success).toBe(true);
    }
  });

  it('rechaza teléfono con menos de 10 dígitos', () => {
    const result = patientSchema.safeParse({ ...validPatient, phone: '12345' });
    expect(result.success).toBe(false);
  });

  it('acepta email válido opcional', () => {
    const result = patientSchema.safeParse({ ...validPatient, email: 'test@example.com' });
    expect(result.success).toBe(true);
  });

  it('rechaza email con formato inválido', () => {
    const result = patientSchema.safeParse({ ...validPatient, email: 'no-es-email' });
    expect(result.success).toBe(false);
  });

  it('rechaza más de 50 alergias', () => {
    const allergies = Array.from({ length: 51 }, (_, i) => `Alergia ${i}`);
    const result = patientSchema.safeParse({ ...validPatient, allergies });
    expect(result.success).toBe(false);
  });

  it('rechaza alergia con más de 200 caracteres', () => {
    const allergies = ['A'.repeat(201)];
    const result = patientSchema.safeParse({ ...validPatient, allergies });
    expect(result.success).toBe(false);
  });

  it('rechaza más de 30 cirugías previas', () => {
    const previousSurgeries = Array.from({ length: 31 }, (_, i) => ({
      name: `Cirugía ${i}`,
      date: new Date('2020-01-01'),
    }));
    const result = patientSchema.safeParse({ ...validPatient, previousSurgeries });
    expect(result.success).toBe(false);
  });
});

describe('profilePhotoSchema', () => {
  it('acepta JPEG dentro del límite de tamaño', () => {
    const result = profilePhotoSchema.safeParse({
      mimeType: 'image/jpeg',
      sizeBytes: 2 * 1024 * 1024,
    });
    expect(result.success).toBe(true);
  });

  it('acepta PNG dentro del límite', () => {
    const result = profilePhotoSchema.safeParse({
      mimeType: 'image/png',
      sizeBytes: 1024,
    });
    expect(result.success).toBe(true);
  });

  it('rechaza MIME type no permitido', () => {
    const result = profilePhotoSchema.safeParse({
      mimeType: 'image/gif',
      sizeBytes: 1024,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza foto mayor a 5MB', () => {
    const result = profilePhotoSchema.safeParse({
      mimeType: 'image/jpeg',
      sizeBytes: 6 * 1024 * 1024,
    });
    expect(result.success).toBe(false);
  });
});
