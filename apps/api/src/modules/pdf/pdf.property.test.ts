import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { PDFDocument } from 'pdf-lib';
import * as zlib from 'zlib';
import { generateWhatsAppUrl, WhatsAppReminderData } from '../dashboard/whatsapp.util';
import { PDFService } from './pdf.service';

/**
 * Property-Based Tests for WhatsApp URL Generation and PDF Data Injection.
 *
 * **Validates: Requirements 6.2, 6.4**
 */

const NUM_RUNS = 100;

// ============================================================
// HELPERS
// ============================================================

/**
 * Extracts text content from a PDF buffer by decompressing content streams
 * and decoding hex-encoded strings from Tj/TJ operators.
 *
 * pdf-lib stores text as hex-encoded strings (e.g. <48656C6C6F> Tj) inside
 * deflate-compressed content streams.
 */
function extractTextFromPdf(pdfBuffer: Buffer): string {
  const bufStr = pdfBuffer.toString('binary');
  const extractedTexts: string[] = [];

  let pos = 0;
  while (true) {
    const streamStart = bufStr.indexOf('stream\n', pos);
    if (streamStart === -1) break;
    const dataStart = streamStart + 'stream\n'.length;
    const endStream = bufStr.indexOf('endstream', dataStart);
    if (endStream === -1) break;

    let dataEnd = endStream;
    if (bufStr[dataEnd - 1] === '\n') dataEnd--;
    if (bufStr[dataEnd - 1] === '\r') dataEnd--;

    const streamData = Buffer.from(bufStr.substring(dataStart, dataEnd), 'binary');
    pos = endStream + 9;

    let decompressed: string | null = null;
    try {
      const result = zlib.inflateRawSync(streamData.slice(2));
      decompressed = result.toString('binary');
    } catch {
      try {
        const result = zlib.inflateSync(streamData);
        decompressed = result.toString('binary');
      } catch {
        continue;
      }
    }

    if (!decompressed) continue;

    // Extract hex-encoded strings from Tj operators: <hexstring> Tj
    const hexPattern = /<([0-9A-Fa-f]+)>\s*Tj/g;
    let match;
    while ((match = hexPattern.exec(decompressed)) !== null) {
      const hex = match[1];
      let text = '';
      for (let i = 0; i < hex.length; i += 2) {
        text += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
      }
      extractedTexts.push(text);
    }
  }

  return extractedTexts.join(' ');
}

// ============================================================
// ARBITRARIES
// ============================================================

// --- Property 9: WhatsApp URL Generation ---

/** Generate a non-empty clinic name with printable characters */
const clinicNameArb = fc
  .string({ minLength: 1, maxLength: 60, unit: 'grapheme' })
  .filter((s) => s.trim().length > 0);

/** Generate a non-empty patient name with printable characters */
const patientNameArb = fc
  .string({ minLength: 1, maxLength: 80, unit: 'grapheme' })
  .filter((s) => s.trim().length > 0);

/** Generate phone numbers with various formats (digits, spaces, dashes, parens, plus) */
const phoneArb = fc
  .tuple(
    fc.constantFrom('+52 ', '+1 ', '+34 ', '', '('),
    fc.stringOf(
      fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ' ', '-', ')', '('),
      { minLength: 7, maxLength: 20 },
    ),
  )
  .map(([prefix, body]) => `${prefix}${body}`)
  .filter((phone) => phone.replace(/\D/g, '').length >= 7);

/** Generate formatted date strings (e.g., "15 de enero de 2024") */
const appointmentDateArb = fc
  .tuple(
    fc.integer({ min: 1, max: 31 }),
    fc.constantFrom(
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    ),
    fc.integer({ min: 2020, max: 2030 }),
  )
  .map(([day, month, year]) => `${day} de ${month} de ${year}`);

/** Generate formatted time strings (e.g., "10:30 AM") */
const appointmentTimeArb = fc
  .tuple(
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 0, max: 59 }),
    fc.constantFrom('AM', 'PM'),
  )
  .map(([hour, minute, period]) => `${hour}:${minute.toString().padStart(2, '0')} ${period}`);

/** Generate a complete WhatsAppReminderData object */
const whatsAppReminderDataArb = fc
  .tuple(clinicNameArb, patientNameArb, phoneArb, appointmentDateArb, appointmentTimeArb)
  .map(([clinicName, patientName, patientPhone, appointmentDate, appointmentTime]): WhatsAppReminderData => ({
    clinicName,
    patientName,
    patientPhone,
    appointmentDate,
    appointmentTime,
  }));

// --- Property 10: PDF Data Injection ---

/** Generate patient name using only ASCII characters for reliable PDF matching */
const pdfPatientNameArb = fc
  .tuple(
    fc.stringOf(
      fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('')),
      { minLength: 2, maxLength: 15 },
    ),
    fc.stringOf(
      fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('')),
      { minLength: 2, maxLength: 15 },
    ),
  )
  .map(([first, last]) => `${first} ${last}`);

/** Generate prescription content using only ASCII characters for reliable PDF matching */
const pdfContentArb = fc
  .array(
    fc.stringOf(
      fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 '.split('')),
      { minLength: 5, maxLength: 40 },
    ).filter((s) => s.trim().length >= 5),
    { minLength: 1, maxLength: 3 },
  )
  .map((lines) => lines.join('\n'));

// ============================================================
// PROPERTY TESTS
// ============================================================

describe('Property 9: Generación de URL WhatsApp', () => {
  /**
   * **Validates: Requirements 6.2**
   *
   * Property 9: Para cualquier combinación válida de datos de paciente (nombre, teléfono)
   * y cita (fecha, hora) y configuración de clínica (nombre), la URL generada SHALL seguir
   * el formato `wa.me/{teléfono}?text={mensaje}` donde el mensaje contiene el nombre de la
   * clínica, nombre del paciente, fecha y hora de la cita.
   */

  it('should generate a URL that starts with https://wa.me/', () => {
    fc.assert(
      fc.property(whatsAppReminderDataArb, (data) => {
        const url = generateWhatsAppUrl(data);
        expect(url).toMatch(/^https:\/\/wa\.me\//);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should contain only digits in the phone segment of the URL', () => {
    fc.assert(
      fc.property(whatsAppReminderDataArb, (data) => {
        const url = generateWhatsAppUrl(data);
        const phoneMatch = url.match(/^https:\/\/wa\.me\/([^?]+)\?text=/);
        expect(phoneMatch).not.toBeNull();
        const phonePart = phoneMatch![1];
        expect(phonePart).toMatch(/^\d+$/);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should have a ?text= query parameter', () => {
    fc.assert(
      fc.property(whatsAppReminderDataArb, (data) => {
        const url = generateWhatsAppUrl(data);
        expect(url).toContain('?text=');
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should contain clinic name, patient name, date and time when decoded', () => {
    fc.assert(
      fc.property(whatsAppReminderDataArb, (data) => {
        const url = generateWhatsAppUrl(data);
        const textParam = url.split('?text=')[1];
        const decodedMessage = decodeURIComponent(textParam);

        expect(decodedMessage).toContain(data.clinicName);
        expect(decodedMessage).toContain(data.patientName);
        expect(decodedMessage).toContain(data.appointmentDate);
        expect(decodedMessage).toContain(data.appointmentTime);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should produce a parseable URL', () => {
    fc.assert(
      fc.property(whatsAppReminderDataArb, (data) => {
        const url = generateWhatsAppUrl(data);
        const parsed = new URL(url);
        expect(parsed.protocol).toBe('https:');
        expect(parsed.hostname).toBe('wa.me');
        expect(parsed.searchParams.has('text')).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Property 10: Inyección de datos en PDF con membrete', () => {
  /**
   * **Validates: Requirements 6.4**
   *
   * Property 10: Para cualquier combinación válida de datos de paciente y contenido de
   * prescripción, y una configuración de coordenadas de membrete, el PDF generado SHALL
   * contener como texto extraíble: el nombre del paciente, la fecha y el contenido de
   * la prescripción.
   */

  let service: PDFService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      prescription: {
        findUnique: vi.fn(),
      },
      clinic: {
        findFirst: vi.fn(),
      },
    };

    service = new PDFService(mockPrisma);
  });

  it('should produce a valid PDF that contains the patient name', async () => {
    await fc.assert(
      fc.asyncProperty(pdfPatientNameArb, pdfContentArb, async (patientName, content) => {
        const mockDate = new Date('2024-06-15T10:30:00Z');
        const mockPrescription = {
          id: 'test-id',
          patientId: 'patient-id',
          doctorId: 'doctor-id',
          content,
          status: 'pending',
          createdAt: mockDate,
          patient: { fullName: patientName },
          doctor: { fullName: 'Doctor Test' },
        };

        mockPrisma.prescription.findUnique.mockResolvedValue(mockPrescription);
        mockPrisma.clinic.findFirst.mockResolvedValue(null);

        const result = await service.generatePrescriptionPdf('test-id');

        // Verify the PDF is valid
        const pdfDoc = await PDFDocument.load(result.buffer);
        expect(pdfDoc.getPageCount()).toBeGreaterThanOrEqual(1);

        // Extract text from PDF content streams and verify patient name
        const extractedText = extractTextFromPdf(result.buffer);
        expect(extractedText).toContain(patientName);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should produce a valid PDF that contains the date', async () => {
    await fc.assert(
      fc.asyncProperty(pdfPatientNameArb, pdfContentArb, async (patientName, content) => {
        const mockDate = new Date('2024-06-15T10:30:00Z');
        const mockPrescription = {
          id: 'test-id',
          patientId: 'patient-id',
          doctorId: 'doctor-id',
          content,
          status: 'pending',
          createdAt: mockDate,
          patient: { fullName: patientName },
          doctor: { fullName: 'Doctor Test' },
        };

        mockPrisma.prescription.findUnique.mockResolvedValue(mockPrescription);
        mockPrisma.clinic.findFirst.mockResolvedValue(null);

        const result = await service.generatePrescriptionPdf('test-id');

        // The date is formatted with toLocaleDateString('es-MX', {...})
        const expectedDate = mockDate.toLocaleDateString('es-MX', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        // Extract text from PDF content streams and verify date
        const extractedText = extractTextFromPdf(result.buffer);
        expect(extractedText).toContain(expectedDate);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should produce a valid PDF that contains the prescription content', async () => {
    await fc.assert(
      fc.asyncProperty(pdfPatientNameArb, pdfContentArb, async (patientName, content) => {
        const mockDate = new Date('2024-06-15T10:30:00Z');
        const mockPrescription = {
          id: 'test-id',
          patientId: 'patient-id',
          doctorId: 'doctor-id',
          content,
          status: 'pending',
          createdAt: mockDate,
          patient: { fullName: patientName },
          doctor: { fullName: 'Doctor Test' },
        };

        mockPrisma.prescription.findUnique.mockResolvedValue(mockPrescription);
        mockPrisma.clinic.findFirst.mockResolvedValue(null);

        const result = await service.generatePrescriptionPdf('test-id');

        // Extract text from PDF content streams
        const extractedText = extractTextFromPdf(result.buffer);

        // Verify each content line's words appear in the extracted text
        const contentLines = content.split('\n');
        for (const line of contentLines) {
          const words = line.trim().split(/\s+/).filter((w) => w.length > 2);
          for (const word of words) {
            expect(extractedText).toContain(word);
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
