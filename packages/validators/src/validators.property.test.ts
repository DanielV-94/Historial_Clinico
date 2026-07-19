import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { patientSchema, profilePhotoSchema } from './patient.schema';
import {
  fileValidationSchema,
  ALL_ALLOWED_MIME_TYPES,
  FILE_SIZE_LIMITS,
  getCategoryFromMime,
} from './file.schema';
import { clinicalNoteContentSchema, NOTE_MIN_LENGTH, NOTE_MAX_LENGTH } from './note.schema';
import { themeConfigSchema, hexColorSchema, logoSchema } from './theme.schema';
import { passwordSchema, PASSWORD_MIN_LENGTH } from './password.schema';

const NUM_RUNS = 100;

// ============================================================
// HELPERS: Generators
// ============================================================

/** Generate a past date (not future) */
const pastDateArb = fc.date({
  min: new Date('1900-01-01'),
  max: new Date(),
});

/** Generate a future date */
const futureDateArb = fc.date({
  min: new Date(Date.now() + 86_400_000), // tomorrow
  max: new Date('2100-01-01'),
});

/** Generate a valid phone (10+ digits) */
const validPhoneArb = fc
  .integer({ min: 10, max: 15 })
  .chain((len) => fc.stringOf(fc.constantFrom(...'0123456789'.split('')), { minLength: len, maxLength: len }));

/** Generate a short phone (<10 digits) */
const invalidPhoneArb = fc.stringOf(
  fc.constantFrom(...'0123456789'.split('')),
  { minLength: 1, maxLength: 9 }
);

/** Generate valid sex */
const validSexArb = fc.constantFrom('M', 'F', 'O');

/** Generate non-empty string up to a max length */
const nonEmptyStringArb = (maxLen = 100) =>
  fc.string({ minLength: 1, maxLength: maxLen }).filter((s) => s.trim().length > 0);

/** Generate a valid hex color (#RRGGBB) */
const validHexColorArb = fc
  .stringOf(fc.constantFrom(...'0123456789ABCDEFabcdef'.split('')), { minLength: 6, maxLength: 6 })
  .map((s) => `#${s}`);

/** Generate an invalid hex color */
const invalidHexColorArb = fc.oneof(
  fc.constant('#GGG'),
  fc.constant('123456'),
  fc.constant('#12345'),
  fc.constant('#1234567'),
  fc.constant(''),
  fc.string({ minLength: 1, maxLength: 10 }).filter((s) => !/^#[0-9A-Fa-f]{6}$/.test(s))
);

/** Generate a valid SHA-256 checksum (64 hex chars) */
const validChecksumArb = fc.stringOf(
  fc.constantFrom(...'0123456789abcdef'.split('')),
  { minLength: 64, maxLength: 64 }
);

/** Generate a valid MIME type from the whitelist */
const validMimeArb = fc.constantFrom(...ALL_ALLOWED_MIME_TYPES);

/** Generate an invalid MIME type */
const invalidMimeArb = fc.constantFrom(
  'application/json',
  'text/html',
  'image/gif',
  'video/avi',
  'application/xml',
  'audio/mp3'
);

// ============================================================
// Property 1: Validación de campos obligatorios del paciente
// Validates: Requirements 1.3, 1.4
// ============================================================

describe('Property 1: Validación de campos obligatorios del paciente', () => {
  /**
   * **Validates: Requirements 1.3**
   * Valid objects with non-empty fullName, past birthDate, valid sex (M/F/O),
   * and 10+ digit phone SHALL be accepted.
   */
  it('acepta pacientes con todos los campos obligatorios válidos', () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb(100),
        pastDateArb,
        validSexArb,
        validPhoneArb,
        (fullName, birthDate, sex, phone) => {
          const result = patientSchema.safeParse({
            fullName,
            birthDate,
            sex,
            phone,
          });
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 1.4**
   * Objects with empty fullName SHALL be rejected.
   */
  it('rechaza pacientes con nombre vacío', () => {
    fc.assert(
      fc.property(
        pastDateArb,
        validSexArb,
        validPhoneArb,
        (birthDate, sex, phone) => {
          const result = patientSchema.safeParse({
            fullName: '',
            birthDate,
            sex,
            phone,
          });
          expect(result.success).toBe(false);
          if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('fullName');
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 1.4**
   * Objects with future birthDate SHALL be rejected.
   */
  it('rechaza pacientes con fecha de nacimiento futura', () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb(50),
        futureDateArb,
        validSexArb,
        validPhoneArb,
        (fullName, birthDate, sex, phone) => {
          const result = patientSchema.safeParse({
            fullName,
            birthDate,
            sex,
            phone,
          });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 1.4**
   * Objects with invalid sex SHALL be rejected.
   */
  it('rechaza pacientes con sexo inválido', () => {
    const invalidSexArb = fc.string({ minLength: 1, maxLength: 3 })
      .filter((s) => !['M', 'F', 'O'].includes(s));

    fc.assert(
      fc.property(
        nonEmptyStringArb(50),
        pastDateArb,
        invalidSexArb,
        validPhoneArb,
        (fullName, birthDate, sex, phone) => {
          const result = patientSchema.safeParse({
            fullName,
            birthDate,
            sex,
            phone,
          });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 1.4**
   * Objects with phone < 10 digits SHALL be rejected.
   */
  it('rechaza pacientes con teléfono menor a 10 dígitos', () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb(50),
        pastDateArb,
        validSexArb,
        invalidPhoneArb,
        (fullName, birthDate, sex, phone) => {
          const result = patientSchema.safeParse({
            fullName,
            birthDate,
            sex,
            phone,
          });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});

// ============================================================
// Property 2: Límites de datos en creación de paciente
// Validates: Requirements 1.1
// ============================================================

describe('Property 2: Límites de datos en creación de paciente', () => {
  const basePatient = {
    fullName: 'Test Patient',
    birthDate: new Date('1990-01-01'),
    sex: 'M' as const,
    phone: '5551234567',
  };

  /**
   * **Validates: Requirements 1.1**
   * Reject if > 50 allergies.
   */
  it('rechaza pacientes con más de 50 alergias', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 51, max: 100 }),
        (count) => {
          const allergies = Array.from({ length: count }, (_, i) => `Alergia ${i}`);
          const result = patientSchema.safeParse({ ...basePatient, allergies });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 1.1**
   * Accept if ≤ 50 allergies with valid content.
   */
  it('acepta pacientes con hasta 50 alergias válidas', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50 }),
        (count) => {
          const allergies = Array.from({ length: count }, (_, i) => `Alergia ${i}`);
          const result = patientSchema.safeParse({ ...basePatient, allergies });
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 1.1**
   * Reject any allergy exceeding 200 characters.
   */
  it('rechaza alergias con más de 200 caracteres', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 201, max: 500 }),
        (len) => {
          const allergies = ['A'.repeat(len)];
          const result = patientSchema.safeParse({ ...basePatient, allergies });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 1.1**
   * Reject if > 30 surgeries.
   */
  it('rechaza pacientes con más de 30 cirugías previas', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 31, max: 60 }),
        (count) => {
          const previousSurgeries = Array.from({ length: count }, (_, i) => ({
            name: `Cirugía ${i}`,
            date: new Date('2020-01-01'),
          }));
          const result = patientSchema.safeParse({ ...basePatient, previousSurgeries });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 1.1**
   * Reject profile photo > 5MB or not JPEG/PNG.
   */
  it('rechaza foto de perfil mayor a 5MB', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5 * 1024 * 1024 + 1, max: 20 * 1024 * 1024 }),
        fc.constantFrom('image/jpeg', 'image/png'),
        (sizeBytes, mimeType) => {
          const result = profilePhotoSchema.safeParse({ mimeType, sizeBytes });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it('rechaza foto de perfil con formato no JPEG/PNG', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 * 1024 * 1024 }),
        fc.constantFrom('image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'),
        (sizeBytes, mimeType) => {
          const result = profilePhotoSchema.safeParse({ mimeType, sizeBytes });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it('acepta foto de perfil JPEG/PNG dentro de 5MB', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 * 1024 * 1024 }),
        fc.constantFrom('image/jpeg', 'image/png'),
        (sizeBytes, mimeType) => {
          const result = profilePhotoSchema.safeParse({ mimeType, sizeBytes });
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});

// ============================================================
// Property 4: Validación compuesta de archivos
// Validates: Requirements 2.4, 3.5, 3.6, 12.3
// ============================================================

describe('Property 4: Validación compuesta de archivos', () => {
  /**
   * **Validates: Requirements 12.3**
   * Accept only if MIME in whitelist AND size within category limit AND valid checksum.
   */
  it('acepta archivos con MIME válido, tamaño dentro del límite y checksum correcto', () => {
    fc.assert(
      fc.property(
        validMimeArb,
        validChecksumArb,
        (mimeType, checksum) => {
          const category = getCategoryFromMime(mimeType)!;
          const maxSize = FILE_SIZE_LIMITS[category];
          // Pick a size within the valid range
          const sizeBytes = Math.floor(Math.random() * maxSize) + 1;
          const result = fileValidationSchema.safeParse({ mimeType, sizeBytes, checksum });
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 2.4, 3.5, 3.6**
   * Reject files with MIME not in the whitelist.
   */
  it('rechaza archivos con MIME no permitido', () => {
    fc.assert(
      fc.property(
        invalidMimeArb,
        fc.integer({ min: 1, max: FILE_SIZE_LIMITS.general }),
        validChecksumArb,
        (mimeType, sizeBytes, checksum) => {
          const result = fileValidationSchema.safeParse({ mimeType, sizeBytes, checksum });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 2.4, 3.6**
   * Reject files exceeding category size limit.
   */
  it('rechaza archivos que exceden el límite de tamaño por categoría', () => {
    fc.assert(
      fc.property(
        validMimeArb,
        validChecksumArb,
        (mimeType, checksum) => {
          const category = getCategoryFromMime(mimeType)!;
          const limit = FILE_SIZE_LIMITS[category];
          const sizeBytes = limit + Math.floor(Math.random() * 1_000_000) + 1;
          const result = fileValidationSchema.safeParse({ mimeType, sizeBytes, checksum });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 12.3**
   * Reject files with invalid checksum format.
   */
  it('rechaza archivos con checksum inválido', () => {
    const invalidChecksumArb = fc.oneof(
      fc.string({ minLength: 1, maxLength: 63 }),
      fc.string({ minLength: 65, maxLength: 100 }),
      fc.constant('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')
    );

    fc.assert(
      fc.property(
        validMimeArb,
        fc.integer({ min: 1, max: FILE_SIZE_LIMITS.pdf }),
        invalidChecksumArb,
        (mimeType, sizeBytes, checksum) => {
          const result = fileValidationSchema.safeParse({ mimeType, sizeBytes, checksum });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});

// ============================================================
// Property 8: Validación de notas clínicas
// Validates: Requirements 4.2
// ============================================================

describe('Property 8: Validación de notas clínicas', () => {
  /**
   * **Validates: Requirements 4.2**
   * Accept content with length between 1 and 10,000 characters.
   */
  it('acepta notas con longitud entre 1 y 10,000 caracteres', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: NOTE_MIN_LENGTH, maxLength: NOTE_MAX_LENGTH })
          .filter((s) => s.length >= NOTE_MIN_LENGTH),
        (content) => {
          const result = clinicalNoteContentSchema.safeParse(content);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 4.2**
   * Reject empty content.
   */
  it('rechaza notas con contenido vacío', () => {
    const result = clinicalNoteContentSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  /**
   * **Validates: Requirements 4.2**
   * Reject content exceeding 10,000 characters.
   */
  it('rechaza notas que exceden 10,000 caracteres', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: NOTE_MAX_LENGTH + 1, max: NOTE_MAX_LENGTH + 5000 }),
        (len) => {
          const content = 'A'.repeat(len);
          const result = clinicalNoteContentSchema.safeParse(content);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});

// ============================================================
// Property 15: Validación de esquema de tema
// Validates: Requirements 10.1
// ============================================================

describe('Property 15: Validación de esquema de tema', () => {
  /**
   * **Validates: Requirements 10.1**
   * Accept valid theme: non-empty clinicName, valid hex colors,
   * non-empty fontFamily, and optional logo PNG/SVG ≤2MB.
   */
  it('acepta temas con colores hex válidos, nombre y fuente no vacíos', () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb(50),
        validHexColorArb,
        validHexColorArb,
        validHexColorArb,
        nonEmptyStringArb(30),
        (clinicName, primary, secondary, accent, fontFamily) => {
          const result = themeConfigSchema.safeParse({
            clinicName,
            primaryColor: primary,
            secondaryColor: secondary,
            accentColor: accent,
            fontFamily,
          });
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 10.1**
   * Accept valid theme with PNG/SVG logo ≤ 2MB.
   */
  it('acepta temas con logo PNG/SVG dentro de 2MB', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('image/png', 'image/svg+xml'),
        fc.integer({ min: 1, max: 2 * 1024 * 1024 }),
        (mimeType, sizeBytes) => {
          const result = logoSchema.safeParse({ mimeType, sizeBytes });
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 10.1**
   * Reject logo > 2MB.
   */
  it('rechaza logo que excede 2MB', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('image/png', 'image/svg+xml'),
        fc.integer({ min: 2 * 1024 * 1024 + 1, max: 10 * 1024 * 1024 }),
        (mimeType, sizeBytes) => {
          const result = logoSchema.safeParse({ mimeType, sizeBytes });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 10.1**
   * Reject logo with invalid MIME type.
   */
  it('rechaza logo con formato no PNG/SVG', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('image/jpeg', 'image/gif', 'image/webp', 'application/pdf'),
        fc.integer({ min: 1, max: 2 * 1024 * 1024 }),
        (mimeType, sizeBytes) => {
          const result = logoSchema.safeParse({ mimeType, sizeBytes });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 10.1**
   * Reject theme with invalid hex color.
   */
  it('rechaza temas con color hex inválido', () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb(50),
        invalidHexColorArb,
        validHexColorArb,
        validHexColorArb,
        nonEmptyStringArb(30),
        (clinicName, badColor, secondary, accent, fontFamily) => {
          const result = themeConfigSchema.safeParse({
            clinicName,
            primaryColor: badColor,
            secondaryColor: secondary,
            accentColor: accent,
            fontFamily,
          });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 10.1**
   * Reject theme with empty clinic name.
   */
  it('rechaza temas con nombre de clínica vacío', () => {
    fc.assert(
      fc.property(
        validHexColorArb,
        validHexColorArb,
        validHexColorArb,
        nonEmptyStringArb(30),
        (primary, secondary, accent, fontFamily) => {
          const result = themeConfigSchema.safeParse({
            clinicName: '',
            primaryColor: primary,
            secondaryColor: secondary,
            accentColor: accent,
            fontFamily,
          });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 10.1**
   * Reject theme with empty font family.
   */
  it('rechaza temas con familia tipográfica vacía', () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb(50),
        validHexColorArb,
        validHexColorArb,
        validHexColorArb,
        (clinicName, primary, secondary, accent) => {
          const result = themeConfigSchema.safeParse({
            clinicName,
            primaryColor: primary,
            secondaryColor: secondary,
            accentColor: accent,
            fontFamily: '',
          });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});

// ============================================================
// Property 16: Validación de contraseña
// Validates: Requirements 13.1
// ============================================================

describe('Property 16: Validación de contraseña', () => {
  /**
   * **Validates: Requirements 13.1**
   * Accept passwords with 8+ chars, at least 1 uppercase, 1 lowercase, 1 number.
   */
  it('acepta contraseñas con 8+ chars, mayúscula, minúscula y número', () => {
    // Generate valid passwords: guaranteed to have uppercase, lowercase, digit
    const validPasswordArb = fc
      .tuple(
        fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), { minLength: 1, maxLength: 5 }),
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 5 }),
        fc.stringOf(fc.constantFrom(...'0123456789'.split('')), { minLength: 1, maxLength: 5 }),
        fc.string({ minLength: 0, maxLength: 20 })
      )
      .map(([upper, lower, digit, extra]) => upper + lower + digit + extra)
      .filter((s) => s.length >= PASSWORD_MIN_LENGTH);

    fc.assert(
      fc.property(validPasswordArb, (password) => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(true);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 13.1**
   * Reject passwords shorter than 8 characters.
   */
  it('rechaza contraseñas menores a 8 caracteres', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 7 }),
        (password) => {
          const result = passwordSchema.safeParse(password);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 13.1**
   * Reject passwords without uppercase letter.
   */
  it('rechaza contraseñas sin letra mayúscula', () => {
    // Only lowercase and digits, 8+ chars
    const noUpperArb = fc
      .tuple(
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 4, maxLength: 10 }),
        fc.stringOf(fc.constantFrom(...'0123456789'.split('')), { minLength: 4, maxLength: 10 })
      )
      .map(([lower, digit]) => lower + digit)
      .filter((s) => s.length >= PASSWORD_MIN_LENGTH && !/[A-Z]/.test(s));

    fc.assert(
      fc.property(noUpperArb, (password) => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(false);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 13.1**
   * Reject passwords without lowercase letter.
   */
  it('rechaza contraseñas sin letra minúscula', () => {
    // Only uppercase and digits, 8+ chars
    const noLowerArb = fc
      .tuple(
        fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), { minLength: 4, maxLength: 10 }),
        fc.stringOf(fc.constantFrom(...'0123456789'.split('')), { minLength: 4, maxLength: 10 })
      )
      .map(([upper, digit]) => upper + digit)
      .filter((s) => s.length >= PASSWORD_MIN_LENGTH && !/[a-z]/.test(s));

    fc.assert(
      fc.property(noLowerArb, (password) => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(false);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 13.1**
   * Reject passwords without a digit.
   */
  it('rechaza contraseñas sin número', () => {
    // Only letters, 8+ chars
    const noDigitArb = fc
      .tuple(
        fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), { minLength: 4, maxLength: 10 }),
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 4, maxLength: 10 })
      )
      .map(([upper, lower]) => upper + lower)
      .filter((s) => s.length >= PASSWORD_MIN_LENGTH && !/[0-9]/.test(s));

    fc.assert(
      fc.property(noDigitArb, (password) => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(false);
      }),
      { numRuns: NUM_RUNS }
    );
  });
});
