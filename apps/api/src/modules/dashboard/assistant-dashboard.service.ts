import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface AppointmentMaterialItem {
  id: string;
  materialName: string;
  quantity: number;
  notes: string | null;
}

export interface AssistantTodayAppointment {
  id: string;
  appointmentTime: Date;
  reason: string;
  status: string;
  patient: {
    id: string;
    fullName: string;
  };
  materials: AppointmentMaterialItem[];
}

export interface AssistantTodayResponse {
  appointments: AssistantTodayAppointment[];
}

@Injectable()
export class AssistantDashboardService {
  private readonly logger = new Logger(AssistantDashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Gets today's appointments for the assistant dashboard, ordered by appointmentTime ASC.
   * Includes patient name, reason, and materials/insumos list per appointment.
   * Not filtered by specific assistant — shows ALL appointments for today.
   *
   * @validates Requirements 6.1
   */
  async getTodayAppointments(): Promise<AssistantTodayResponse> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const appointments = await this.prisma.appointment.findMany({
      where: {
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
        materials: {
          select: {
            id: true,
            materialName: true,
            quantity: true,
            notes: true,
          },
        },
      },
    });

    return {
      appointments,
    };
  }
}
