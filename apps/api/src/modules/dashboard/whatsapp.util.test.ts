import { describe, it, expect } from 'vitest';
import { generateWhatsAppUrl, WhatsAppReminderData } from './whatsapp.util';

describe('generateWhatsAppUrl', () => {
  const baseData: WhatsAppReminderData = {
    clinicName: 'Clínica Estética Premium',
    patientName: 'María García López',
    patientPhone: '+52 55 1234 5678',
    appointmentDate: '15 de enero de 2024',
    appointmentTime: '10:30 AM',
  };

  it('should generate a URL that starts with https://wa.me/', () => {
    const url = generateWhatsAppUrl(baseData);

    expect(url).toMatch(/^https:\/\/wa\.me\//);
  });

  it('should clean phone number of all non-digit characters', () => {
    const url = generateWhatsAppUrl(baseData);

    // Phone '+52 55 1234 5678' should become '525512345678' (only digits)
    expect(url).toContain('https://wa.me/525512345678');
  });

  it('should handle phone numbers with dashes and parentheses', () => {
    const data: WhatsAppReminderData = {
      ...baseData,
      patientPhone: '(55) 1234-5678',
    };

    const url = generateWhatsAppUrl(data);

    expect(url).toContain('https://wa.me/5512345678');
  });

  it('should handle phone numbers that are already clean', () => {
    const data: WhatsAppReminderData = {
      ...baseData,
      patientPhone: '5215512345678',
    };

    const url = generateWhatsAppUrl(data);

    expect(url).toContain('https://wa.me/5215512345678');
  });

  it('should include clinic name in the encoded message', () => {
    const url = generateWhatsAppUrl(baseData);
    const decodedMessage = decodeURIComponent(url.split('?text=')[1]);

    expect(decodedMessage).toContain('Clínica Estética Premium');
  });

  it('should include patient name in the encoded message', () => {
    const url = generateWhatsAppUrl(baseData);
    const decodedMessage = decodeURIComponent(url.split('?text=')[1]);

    expect(decodedMessage).toContain('María García López');
  });

  it('should include appointment date in the encoded message', () => {
    const url = generateWhatsAppUrl(baseData);
    const decodedMessage = decodeURIComponent(url.split('?text=')[1]);

    expect(decodedMessage).toContain('15 de enero de 2024');
  });

  it('should include appointment time in the encoded message', () => {
    const url = generateWhatsAppUrl(baseData);
    const decodedMessage = decodeURIComponent(url.split('?text=')[1]);

    expect(decodedMessage).toContain('10:30 AM');
  });

  it('should URL-encode special characters in names (accents, ñ)', () => {
    const data: WhatsAppReminderData = {
      clinicName: 'Clínica Señor Muñoz & Cía.',
      patientName: 'José Ñoño Ávila',
      patientPhone: '5551234567',
      appointmentDate: '20 de febrero de 2024',
      appointmentTime: '3:00 PM',
    };

    const url = generateWhatsAppUrl(data);

    // The URL should be properly encoded (no raw special chars in query)
    expect(url).not.toMatch(/[áéíóúñÑ&]/);
    // But when decoded, the message should contain the original names
    const decodedMessage = decodeURIComponent(url.split('?text=')[1]);
    expect(decodedMessage).toContain('Clínica Señor Muñoz & Cía.');
    expect(decodedMessage).toContain('José Ñoño Ávila');
  });

  it('should have correct URL structure with ?text= query parameter', () => {
    const url = generateWhatsAppUrl(baseData);

    expect(url).toMatch(/^https:\/\/wa\.me\/\d+\?text=.+$/);
  });

  it('should produce a valid URL that can be parsed', () => {
    const url = generateWhatsAppUrl(baseData);

    // Should not throw when parsing as a URL
    const parsed = new URL(url);
    expect(parsed.protocol).toBe('https:');
    expect(parsed.hostname).toBe('wa.me');
    expect(parsed.searchParams.has('text')).toBe(true);
  });

  it('should format message with reminder structure', () => {
    const url = generateWhatsAppUrl(baseData);
    const decodedMessage = decodeURIComponent(url.split('?text=')[1]);

    expect(decodedMessage).toContain('Recordatorio de cita');
    expect(decodedMessage).toContain('Le esperamos');
  });
});
