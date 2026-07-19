import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Subject, Observable, map } from 'rxjs';
import { createPatientSchema } from '@historial/validators';
import { KIOSK_INACTIVITY_TIMEOUT_MS } from '@historial/constants';
import * as fs from 'fs/promises';
import * as path from 'path';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { KioskRegisterDto } from './dto/kiosk-register.dto';

/**
 * SSE event payload for kiosk registration notifications to reception.
 */
export interface KioskRegistrationEvent {
  type: 'new_registration';
  data: {
    patientId: string;
    patientName: string;
    registeredAt: string;
  };
}

/**
 * Kiosk session tracking for inactivity timeout.
 */
interface KioskSession {
  id: string;
  startedAt: Date;
  lastActivityAt: Date;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

@Injectable()
export class KioskService {
  private readonly logger = new Logger(KioskService.name);

  /** Subject for broadcasting SSE events to reception staff. */
  private readonly eventSubject = new Subject<KioskRegistrationEvent>();

  /** Active kiosk sessions tracked for inactivity timeout. */
  private readonly activeSessions = new Map<string, KioskSession>();

  /** Base path for storing signature files */
  private readonly storagePath =
    process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Returns the inactivity timeout value in milliseconds.
   * Used by frontend to configure idle detection.
   */
  getInactivityTimeout(): number {
    return KIOSK_INACTIVITY_TIMEOUT_MS;
  }

  /**
   * Starts a new kiosk session and returns a session ID.
   * Tracks inactivity — if no activity for 3 minutes, session is discarded.
   *
   * Validates: Requirement 7.5
   */
  startSession(): { sessionId: string; timeoutMs: number } {
    const sessionId = crypto.randomUUID();

    const timeoutHandle = setTimeout(() => {
      this.cleanupSession(sessionId);
    }, KIOSK_INACTIVITY_TIMEOUT_MS);

    this.activeSessions.set(sessionId, {
      id: sessionId,
      startedAt: new Date(),
      lastActivityAt: new Date(),
      timeoutHandle,
    });

    this.logger.log(`Kiosk session started: ${sessionId}`);

    return { sessionId, timeoutMs: KIOSK_INACTIVITY_TIMEOUT_MS };
  }

  /**
   * Refreshes the inactivity timer for a session (heartbeat).
   * Called when the frontend detects user activity.
   *
   * Validates: Requirement 7.5
   */
  refreshSession(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Clear existing timeout and set a new one
    clearTimeout(session.timeoutHandle);
    session.lastActivityAt = new Date();
    session.timeoutHandle = setTimeout(() => {
      this.cleanupSession(sessionId);
    }, KIOSK_INACTIVITY_TIMEOUT_MS);

    return true;
  }

  /**
   * Cleans up a session: removes from tracking and discards any partial data.
   * If cleanup fails, forces restart by clearing the session entry anyway.
   *
   * Validates: Requirement 7.5
   */
  cleanupSession(sessionId: string): void {
    try {
      const session = this.activeSessions.get(sessionId);
      if (session) {
        clearTimeout(session.timeoutHandle);
        this.activeSessions.delete(sessionId);
        this.logger.log(
          `Kiosk session ${sessionId} cleaned up due to inactivity`,
        );
      }
    } catch (error) {
      // Force restart: remove session even if cleanup fails
      this.activeSessions.delete(sessionId);
      this.logger.error(
        `Kiosk session ${sessionId} cleanup failed, forced restart`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Registers a new patient from the kiosk wizard.
   * Flow: validate → check duplicate → create patient → store signature → notify reception
   *
   * Must complete within ≤5 seconds (Requirement 7.3).
   *
   * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.6
   */
  async register(
    data: KioskRegisterDto,
    ipAddress: string,
  ): Promise<{ patientId: string; message: string }> {
    // 1. Validate patient fields using shared schema (Requirement 7.4)
    const validation = createPatientSchema.safeParse({
      fullName: data.fullName,
      birthDate: data.birthDate,
      sex: data.sex,
      phone: data.phone,
      email: data.email,
      allergies: data.allergies,
      previousSurgeries: data.previousSurgeries,
    });

    if (!validation.success) {
      const errors = validation.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new BadRequestException({
        message: 'Validación fallida',
        errors,
      });
    }

    // Validate signature image is present
    if (!data.signatureImage || data.signatureImage.trim().length === 0) {
      throw new BadRequestException({
        message: 'Validación fallida',
        errors: [
          { field: 'signatureImage', message: 'La firma digital es obligatoria' },
        ],
      });
    }

    // 2. Check for duplicate patient (Requirement 7.6)
    const duplicateCheck = await this.checkDuplicate(
      data.fullName,
      new Date(data.birthDate),
    );

    if (duplicateCheck.isDuplicate) {
      throw new ConflictException({
        message: 'Paciente ya registrado',
        detail: `Ya existe un paciente con el nombre "${duplicateCheck.existingPatient!.fullName}" y la misma fecha de nacimiento.`,
        existingPatientId: duplicateCheck.existingPatient!.id,
      });
    }

    // 3. Create patient in transaction (same pattern as PatientService)
    const patient = await this.prisma.$transaction(async (tx) => {
      const created = await tx.patient.create({
        data: {
          fullName: data.fullName,
          birthDate: new Date(data.birthDate),
          sex: data.sex,
          phone: data.phone,
          email: data.email || null,
          address: data.address || null,
          bloodType: (data.bloodType as any) || null,
          emergencyContactName: data.emergencyContactName || null,
          emergencyContactPhone: data.emergencyContactPhone || null,
          emergencyContactRelation: data.emergencyContactRelation || null,
          insuranceProvider: data.insuranceProvider || null,
          insurancePolicyNumber: data.insurancePolicyNumber || null,
          allergies: {
            create: (data.allergies || []).map((description) => ({
              description,
            })),
          },
          previousSurgeries: {
            create: (data.previousSurgeries || []).map((surgery) => ({
              name: surgery.name,
              surgeryDate: new Date(surgery.date),
            })),
          },
        },
        include: {
          allergies: true,
          previousSurgeries: true,
        },
      });

      return created;
    });

    // 4. Store signature image (Requirement 7.2)
    let signatureImagePath: string;
    try {
      signatureImagePath = await this.storeSignatureImage(
        patient.id,
        data.signatureImage,
      );
    } catch (error) {
      this.logger.error(
        `Failed to store signature image for patient ${patient.id}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        'Error al guardar la firma digital',
      );
    }

    // 5. Create SignatureRecord in DB
    await this.prisma.signatureRecord.create({
      data: {
        patientId: patient.id,
        signatureImagePath,
        documentType: 'privacy_notice',
        signedAt: new Date(),
      },
    });

    // 6. Emit SSE notification to reception (Requirement 7.3)
    this.eventSubject.next({
      type: 'new_registration',
      data: {
        patientId: patient.id,
        patientName: patient.fullName,
        registeredAt: new Date().toISOString(),
      },
    });

    this.logger.log(
      `Kiosk registration completed for patient ${patient.id} (${patient.fullName})`,
    );

    // 7. Log to audit
    await this.auditService.log({
      userId: 'kiosk-system',
      userRole: 'kiosk',
      action: 'create',
      entityTable: 'patients',
      entityId: patient.id,
      ipAddress,
      result: 'success',
      description: `Paciente registrado desde kiosk: ${patient.fullName}`,
    });

    return {
      patientId: patient.id,
      message: 'Registro completado exitosamente',
    };
  }

  /**
   * Returns the clinic's privacy notice text for display in the kiosk.
   *
   * Validates: Requirement 7.2
   */
  async getPrivacyNotice(): Promise<{ title: string; content: string }> {
    const clinic = await this.prisma.clinic.findFirst({
      select: { privacyNotice: true },
    });

    if (!clinic || !clinic.privacyNotice) {
      throw new NotFoundException(
        'Aviso de privacidad no configurado para esta clínica',
      );
    }

    const notice = clinic.privacyNotice as { title?: string; content?: string };

    return {
      title: notice.title || 'Aviso de Privacidad',
      content: notice.content || '',
    };
  }

  /**
   * Returns an Observable for SSE connection to receive kiosk registration events.
   * Used by the reception frontend to get real-time notifications of new registrations.
   *
   * Validates: Requirement 7.3
   */
  getRegistrationEventStream(): Observable<MessageEvent> {
    return this.eventSubject.asObservable().pipe(
      map(
        (event) =>
          ({
            data: JSON.stringify({
              type: event.type,
              ...event.data,
            }),
          }) as MessageEvent,
      ),
    );
  }

  /**
   * Checks for a duplicate patient based on normalized full name + birth date.
   *
   * Validates: Requirement 7.6
   */
  private async checkDuplicate(
    fullName: string,
    birthDate: Date,
  ): Promise<{
    isDuplicate: boolean;
    existingPatient?: { id: string; fullName: string };
  }> {
    const normalizedName = fullName.trim().toLowerCase();

    const existing = await this.prisma.patient.findFirst({
      where: {
        birthDate,
        fullName: {
          equals: normalizedName,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        fullName: true,
      },
    });

    if (existing) {
      return { isDuplicate: true, existingPatient: existing };
    }

    return { isDuplicate: false };
  }

  /**
   * Stores a base64-encoded signature image as a PNG file on the filesystem.
   * Creates the directory structure if it doesn't exist.
   *
   * @returns The relative path to the stored signature image.
   */
  private async storeSignatureImage(
    patientId: string,
    base64Image: string,
  ): Promise<string> {
    // Strip data URL prefix if present (e.g., "data:image/png;base64,")
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Create directory: storage/patients/{patientId}/signatures/
    const signatureDir = path.join(
      this.storagePath,
      'patients',
      patientId,
      'signatures',
    );
    await fs.mkdir(signatureDir, { recursive: true });

    // Generate unique filename
    const filename = `signature_${Date.now()}.png`;
    const filePath = path.join(signatureDir, filename);

    await fs.writeFile(filePath, buffer);

    // Return relative path for DB storage
    return path.join('patients', patientId, 'signatures', filename);
  }
}
