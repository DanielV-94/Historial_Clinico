/**
 * WhatsApp URL generation utility for appointment reminders.
 *
 * Generates wa.me links with pre-filled messages containing clinic name,
 * patient name, appointment date and time.
 *
 * @validates Requirements 6.2
 */

export interface WhatsAppReminderData {
  clinicName: string;
  patientName: string;
  patientPhone: string;
  appointmentDate: string; // formatted date (e.g., "15 de enero de 2024")
  appointmentTime: string; // formatted time (e.g., "10:30 AM")
}

/**
 * Generates a WhatsApp Web/Desktop URL with a pre-filled reminder message.
 * Format: https://wa.me/{phone}?text={encodedMessage}
 *
 * The message includes: clinic name, patient name, date and time of the appointment.
 *
 * Phone number is cleaned of all non-digit characters to ensure proper formatting.
 *
 * @param data - The reminder data containing patient and appointment info
 * @returns A fully encoded WhatsApp URL ready to open in browser
 *
 * @validates Requirements 6.2
 */
export function generateWhatsAppUrl(data: WhatsAppReminderData): string {
  // Clean phone number: remove all non-digit characters
  const cleanPhone = data.patientPhone.replace(/\D/g, '');

  // Build the reminder message with clinic name, patient name, date and time
  const message = [
    `Recordatorio de cita - ${data.clinicName}`,
    '',
    `Estimado/a ${data.patientName}, le recordamos su cita programada para el ${data.appointmentDate} a las ${data.appointmentTime}.`,
    '',
    'Le esperamos. ¡Gracias!',
  ].join('\n');

  // Encode message for URL (handles special characters, accents, etc.)
  const encodedMessage = encodeURIComponent(message);

  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}
