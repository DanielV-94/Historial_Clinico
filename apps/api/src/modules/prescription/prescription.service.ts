import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Subject, Observable, filter, map } from 'rxjs';
import { DEFAULT_PAGE_SIZE } from '@historial/constants';
import { PrismaService } from '../../database/prisma.service';

/**
 * SSE event payload for prescription notifications.
 */
export interface PrescriptionEvent {
  assistantId: string;
  type: 'new_prescription' | 'delivery_failed';
  data: {
    prescriptionId: string;
    patientName?: string;
    doctorName?: string;
    content?: string;
    message?: string;
    createdAt?: string;
  };
}

export interface PaginatedPrescriptionsResult {
  data: {
    id: string;
    patientId: string;
    doctorId: string;
    assignedTo: string;
    content: string;
    status: string;
    readAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    patient?: { fullName: string };
    doctor?: { fullName: string };
  }[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class PrescriptionService {
  private readonly logger = new Logger(PrescriptionService.name);

  /**
   * Subject for broadcasting SSE events to connected assistants.
   * Events are filtered per-assistant using their userId.
   */
  private readonly eventSubject = new Subject<PrescriptionEvent>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new prescription and emits an SSE notification to the assigned assistant.
   * Delivery must happen within ≤3 seconds (SSE is near-instant).
   * If delivery fails, notifies the doctor with a retry option.
   *
   * @validates Requirements 4.3, 4.5
   */
  async create(
    doctorId: string,
    patientId: string,
    content: string,
    assignedTo: string,
  ) {
    if (!content || content.trim().length === 0) {
      throw new BadRequestException({
        message: 'Validación fallida',
        errors: [{ field: 'content', message: 'El contenido de la prescripción no puede estar vacío' }],
      });
    }

    // Verify the assigned user exists and is an assistant or admin
    const assignee = await this.prisma.user.findUnique({
      where: { id: assignedTo },
      select: { id: true, role: true, fullName: true },
    });

    if (!assignee) {
      throw new BadRequestException({
        message: 'Validación fallida',
        errors: [{ field: 'assignedTo', message: 'El asistente asignado no existe' }],
      });
    }

    if (assignee.role !== 'assistant' && assignee.role !== 'admin') {
      throw new BadRequestException({
        message: 'Validación fallida',
        errors: [{ field: 'assignedTo', message: 'El usuario asignado debe tener rol de asistente o administrador' }],
      });
    }

    // Create the prescription with pending status
    const prescription = await this.prisma.prescription.create({
      data: {
        doctorId,
        patientId,
        content,
        assignedTo,
        status: 'pending',
      },
      include: {
        patient: { select: { fullName: true } },
        doctor: { select: { fullName: true } },
      },
    });

    // Emit SSE event to the assigned assistant
    try {
      this.eventSubject.next({
        assistantId: assignedTo,
        type: 'new_prescription',
        data: {
          prescriptionId: prescription.id,
          patientName: prescription.patient.fullName,
          doctorName: prescription.doctor.fullName,
          content: prescription.content,
          createdAt: prescription.createdAt.toISOString(),
        },
      });

      this.logger.log(
        `Prescription ${prescription.id} created and SSE event emitted to assistant ${assignedTo}`,
      );
    } catch (error) {
      // If SSE delivery fails, notify the doctor
      this.logger.error(
        `Failed to deliver prescription ${prescription.id} notification to assistant ${assignedTo}`,
        error,
      );

      this.notifyDoctorDeliveryFailed(doctorId, prescription.id);

      throw new InternalServerErrorException({
        message: 'La prescripción fue creada pero no se pudo notificar al asistente',
        prescriptionId: prescription.id,
        canRetry: true,
      });
    }

    return prescription;
  }

  /**
   * Retries delivery of a prescription SSE notification.
   * Used when the initial notification delivery fails.
   *
   * @validates Requirements 4.5
   */
  async retryDelivery(prescriptionId: string, doctorId: string) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        patient: { select: { fullName: true } },
        doctor: { select: { fullName: true } },
      },
    });

    if (!prescription) {
      throw new NotFoundException('Prescripción no encontrada');
    }

    if (prescription.doctorId !== doctorId) {
      throw new ForbiddenException('No tiene permiso para reintentar esta prescripción');
    }

    try {
      this.eventSubject.next({
        assistantId: prescription.assignedTo,
        type: 'new_prescription',
        data: {
          prescriptionId: prescription.id,
          patientName: prescription.patient.fullName,
          doctorName: prescription.doctor.fullName,
          content: prescription.content,
          createdAt: prescription.createdAt.toISOString(),
        },
      });

      this.logger.log(
        `Prescription ${prescriptionId} notification retried successfully`,
      );

      return { success: true, message: 'Notificación reenviada exitosamente' };
    } catch (error) {
      this.logger.error(
        `Retry failed for prescription ${prescriptionId}`,
        error,
      );

      throw new InternalServerErrorException({
        message: 'No se pudo reenviar la notificación al asistente',
        canRetry: true,
      });
    }
  }

  /**
   * Gets the prescription inbox for an assistant with pagination.
   * Returns prescriptions ordered by createdAt DESC with read/unread status.
   *
   * @validates Requirements 6.3
   */
  async getInbox(
    assistantId: string,
    page: number = 1,
    limit: number = DEFAULT_PAGE_SIZE,
  ): Promise<PaginatedPrescriptionsResult> {
    const skip = (page - 1) * limit;

    const [prescriptions, total] = await Promise.all([
      this.prisma.prescription.findMany({
        where: { assignedTo: assistantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          patient: { select: { fullName: true } },
          doctor: { select: { fullName: true } },
        },
      }),
      this.prisma.prescription.count({
        where: { assignedTo: assistantId },
      }),
    ]);

    return {
      data: prescriptions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Marks a prescription as read by the assistant.
   * Updates status from 'pending' to 'read' and sets readAt timestamp.
   *
   * @validates Requirements 6.3 (read/unread status)
   */
  async markAsRead(prescriptionId: string, assistantId: string) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
    });

    if (!prescription) {
      throw new NotFoundException('Prescripción no encontrada');
    }

    if (prescription.assignedTo !== assistantId) {
      throw new ForbiddenException('No tiene permiso para modificar esta prescripción');
    }

    if (prescription.status !== 'pending') {
      // Already read or completed — return current state without error
      return prescription;
    }

    const updated = await this.prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        status: 'read',
        readAt: new Date(),
      },
      include: {
        patient: { select: { fullName: true } },
        doctor: { select: { fullName: true } },
      },
    });

    this.logger.log(
      `Prescription ${prescriptionId} marked as read by assistant ${assistantId}`,
    );

    return updated;
  }

  /**
   * Marks a prescription as completed by the assistant.
   * Updates status to 'completed', sets completedAt timestamp.
   * Archives the prescription out of the active inbox.
   *
   * @validates Requirements 6.6
   */
  async markAsCompleted(prescriptionId: string, assistantId: string) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
    });

    if (!prescription) {
      throw new NotFoundException('Prescripción no encontrada');
    }

    if (prescription.assignedTo !== assistantId) {
      throw new ForbiddenException('No tiene permiso para modificar esta prescripción');
    }

    if (prescription.status === 'completed') {
      // Already completed — return current state
      return prescription;
    }

    const updated = await this.prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        // Also set readAt if it wasn't already set (direct completion)
        readAt: prescription.readAt ?? new Date(),
      },
      include: {
        patient: { select: { fullName: true } },
        doctor: { select: { fullName: true } },
      },
    });

    this.logger.log(
      `Prescription ${prescriptionId} marked as completed by assistant ${assistantId}`,
    );

    return updated;
  }

  /**
   * Returns an Observable for SSE connection filtered by assistant ID.
   * The assistant receives only events assigned to them.
   *
   * @validates Requirements 4.3 (≤3 seconds delivery via SSE)
   */
  getEventStream(assistantId: string): Observable<MessageEvent> {
    return this.eventSubject.asObservable().pipe(
      filter((event) => event.assistantId === assistantId),
      map((event) => ({
        data: JSON.stringify({
          type: event.type,
          ...event.data,
        }),
      } as MessageEvent)),
    );
  }

  /**
   * Notifies the doctor that a prescription delivery failed.
   * Emits an SSE event to the doctor (if they have an active connection)
   * or logs the failure for later retrieval.
   */
  private notifyDoctorDeliveryFailed(doctorId: string, prescriptionId: string) {
    this.eventSubject.next({
      assistantId: doctorId, // Reusing the same subject for doctor notifications
      type: 'delivery_failed',
      data: {
        prescriptionId,
        message: `La prescripción ${prescriptionId} no pudo ser entregada al asistente. Puede reintentar el envío.`,
      },
    });
  }
}
