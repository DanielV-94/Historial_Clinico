import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface TodayAppointment {
  id: string;
  appointmentTime: Date;
  reason: string;
  status: string;
  patient: {
    id: string;
    fullName: string;
  };
}

export interface TodayAppointmentsResponse {
  appointments: TodayAppointment[];
  allCompleted: boolean;
}

export interface NextPatientCard {
  fullName: string;
  profilePhotoPath: string | null;
  lastProcedure: {
    content: string;
    date: Date;
  } | null;
  appointmentReason: string;
  allergies: string[];
}

@Injectable()
export class DoctorDashboardService {
  private readonly logger = new Logger(DoctorDashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Gets today's appointments for a doctor, ordered by appointmentTime ASC.
   * Includes patient name and appointment reason.
   * Returns an empty list if no appointments exist for today.
   * Returns allCompleted flag when all appointments are completed/cancelled.
   *
   * @validates Requirements 5.1, 5.4, 5.5
   */
  async getTodayAppointments(doctorId: string): Promise<TodayAppointmentsResponse> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: today,
      },
      orderBy: {
        appointmentTime: 'asc',
      },
      select: {
        id: true,
        appointmentTime: true,
        reason: true,
        status: true,
        patient: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    // Determine if all appointments have been completed
    const allCompleted =
      appointments.length > 0 &&
      appointments.every(
        (appt) => appt.status === 'completed' || appt.status === 'cancelled',
      );

    return {
      appointments,
      allCompleted,
    };
  }

  /**
   * Gets the next patient card for the doctor's dashboard.
   * Finds the next scheduled (not completed/cancelled) appointment for today.
   * Includes: patient fullName, profilePhotoPath, last clinical note (as last procedure),
   * appointment reason, and patient allergies.
   * Returns null if no upcoming appointments or all completed.
   *
   * @validates Requirements 5.2, 5.4, 5.5
   */
  async getNextPatient(doctorId: string): Promise<NextPatientCard | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the next scheduled appointment (not completed or cancelled)
    const nextAppointment = await this.prisma.appointment.findFirst({
      where: {
        doctorId,
        appointmentDate: today,
        status: {
          in: ['scheduled', 'in_progress'],
        },
      },
      orderBy: {
        appointmentTime: 'asc',
      },
      select: {
        reason: true,
        patient: {
          select: {
            id: true,
            fullName: true,
            profilePhotoPath: true,
            allergies: {
              select: {
                description: true,
              },
            },
          },
        },
      },
    });

    if (!nextAppointment) {
      return null;
    }

    // Get the latest clinical note for this patient (as "last procedure")
    const lastNote = await this.prisma.clinicalNote.findFirst({
      where: {
        patientId: nextAppointment.patient.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        content: true,
        createdAt: true,
      },
    });

    return {
      fullName: nextAppointment.patient.fullName,
      profilePhotoPath: nextAppointment.patient.profilePhotoPath,
      lastProcedure: lastNote
        ? { content: lastNote.content, date: lastNote.createdAt }
        : null,
      appointmentReason: nextAppointment.reason,
      allergies: nextAppointment.patient.allergies.map((a) => a.description),
    };
  }
}
