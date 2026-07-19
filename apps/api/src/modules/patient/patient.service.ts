import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createPatientSchema, updatePatientSchema } from '@historial/validators';
import { SEARCH_MAX_RESULTS } from '@historial/constants';
import { PrismaService } from '../../database/prisma.service';
import { CreatePatientDto, UpdatePatientDto } from './dto/create-patient.dto';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingPatient?: {
    id: string;
    fullName: string;
    birthDate: Date;
    phone: string;
  };
}

export interface PatientSearchResult {
  id: string;
  full_name: string;
  birth_date: Date;
  phone: string;
  email: string | null;
  profile_photo_path: string | null;
}

@Injectable()
export class PatientService {
  private readonly logger = new Logger(PatientService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new patient with allergies and previous surgeries in a transaction.
   * Validates input using the shared Zod schema.
   * Checks for duplicates before creating.
   *
   * Requirements: 1.1, 1.3, 1.4, 1.5
   */
  async create(data: CreatePatientDto) {
    // Validate input with shared schema
    const validation = createPatientSchema.safeParse(data);
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

    // Check for duplicate
    const duplicateResult = await this.checkDuplicate(
      data.fullName,
      new Date(data.birthDate),
    );

    if (duplicateResult.isDuplicate) {
      return {
        isDuplicate: true,
        existingPatient: duplicateResult.existingPatient,
      };
    }

    // Create patient + allergies + previous surgeries in a transaction
    const patient = await this.prisma.$transaction(async (tx) => {
      const created = await tx.patient.create({
        data: {
          fullName: data.fullName,
          birthDate: new Date(data.birthDate),
          sex: data.sex,
          phone: data.phone,
          email: data.email || null,
          address: data.address || null,
          bloodType: data.bloodType as any || null,
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

    return { isDuplicate: false, patient };
  }

  /**
   * Finds a patient by ID with all relations grouped by section.
   * Returns patient with allergies and previousSurgeries included.
   *
   * Requirements: 1.2
   */
  async findById(id: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: {
        allergies: true,
        previousSurgeries: true,
      },
    });

    if (!patient) {
      throw new NotFoundException(`Paciente con ID ${id} no encontrado`);
    }

    // Group data by section as required by AC 1.2
    return {
      datosGenerales: {
        id: patient.id,
        fullName: patient.fullName,
        birthDate: patient.birthDate,
        sex: patient.sex,
        phone: patient.phone,
        email: patient.email,
        address: patient.address,
        bloodType: patient.bloodType,
        profilePhotoPath: patient.profilePhotoPath,
      },
      antecedentesMedicos: {
        allergies: patient.allergies.map((a) => ({
          id: a.id,
          description: a.description,
        })),
        previousSurgeries: patient.previousSurgeries.map((s) => ({
          id: s.id,
          name: s.name,
          surgeryDate: s.surgeryDate,
        })),
      },
      contactoEmergencia: {
        name: patient.emergencyContactName,
        phone: patient.emergencyContactPhone,
        relation: patient.emergencyContactRelation,
      },
      seguroMedico: {
        provider: patient.insuranceProvider,
        policyNumber: patient.insurancePolicyNumber,
      },
      metadata: {
        createdAt: patient.createdAt,
        updatedAt: patient.updatedAt,
      },
    };
  }

  /**
   * Updates a patient's data with partial validation.
   *
   * Requirements: 1.3
   */
  async update(id: string, data: UpdatePatientDto) {
    // Validate partial input
    const validation = updatePatientSchema.safeParse(data);
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

    // Verify patient exists
    const existing = await this.prisma.patient.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Paciente con ID ${id} no encontrado`);
    }

    // Build update data
    const updateData: Prisma.PatientUpdateInput = {};

    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.birthDate !== undefined)
      updateData.birthDate = new Date(data.birthDate);
    if (data.sex !== undefined) updateData.sex = data.sex;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.address !== undefined) updateData.address = data.address || null;
    if (data.bloodType !== undefined)
      updateData.bloodType = (data.bloodType as any) || null;
    if (data.emergencyContactName !== undefined)
      updateData.emergencyContactName = data.emergencyContactName || null;
    if (data.emergencyContactPhone !== undefined)
      updateData.emergencyContactPhone = data.emergencyContactPhone || null;
    if (data.emergencyContactRelation !== undefined)
      updateData.emergencyContactRelation =
        data.emergencyContactRelation || null;
    if (data.insuranceProvider !== undefined)
      updateData.insuranceProvider = data.insuranceProvider || null;
    if (data.insurancePolicyNumber !== undefined)
      updateData.insurancePolicyNumber = data.insurancePolicyNumber || null;

    // Handle allergies update if provided
    if (data.allergies !== undefined) {
      // Replace all allergies
      await this.prisma.allergy.deleteMany({ where: { patientId: id } });
      updateData.allergies = {
        create: data.allergies.map((description) => ({ description })),
      };
    }

    // Handle previous surgeries update if provided
    if (data.previousSurgeries !== undefined) {
      // Replace all surgeries
      await this.prisma.previousSurgery.deleteMany({
        where: { patientId: id },
      });
      updateData.previousSurgeries = {
        create: data.previousSurgeries.map((surgery) => ({
          name: surgery.name,
          surgeryDate: new Date(surgery.date),
        })),
      };
    }

    const updated = await this.prisma.patient.update({
      where: { id },
      data: updateData,
      include: {
        allergies: true,
        previousSurgeries: true,
      },
    });

    return updated;
  }

  /**
   * Lists patients with pagination.
   * Returns patients list with total count for pagination metadata.
   *
   * Requirements: 1.1, 1.2
   */
  async findAll(page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [patients, total] = await Promise.all([
      this.prisma.patient.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          allergies: true,
        },
      }),
      this.prisma.patient.count(),
    ]);

    return { patients, total };
  }

  /**
   * Searches patients by name using PostgreSQL trigram similarity.
   * Returns max SEARCH_MAX_RESULTS (10) results ordered by similarity.
   * Uses GIN trigram index on patients.full_name for <500ms performance.
   *
   * Requirements: 5.3
   */
  async search(query: string): Promise<PatientSearchResult[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const trimmedQuery = query.trim();

    const results = await this.prisma.$queryRaw<PatientSearchResult[]>`
      SELECT id, full_name, birth_date, phone, email, profile_photo_path
      FROM patients
      WHERE full_name % ${trimmedQuery}
      ORDER BY similarity(full_name, ${trimmedQuery}) DESC
      LIMIT ${SEARCH_MAX_RESULTS}
    `;

    return results;
  }

  /**
   * Checks for a duplicate patient based on normalized full name + birth date.
   * Normalizes name: trim, lowercase for case-insensitive comparison.
   *
   * Requirements: 1.5
   */
  async checkDuplicate(
    fullName: string,
    birthDate: Date,
  ): Promise<DuplicateCheckResult> {
    const normalizedName = fullName.trim().toLowerCase();

    const existing = await this.prisma.patient.findFirst({
      where: {
        birthDate: birthDate,
        fullName: {
          equals: normalizedName,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        fullName: true,
        birthDate: true,
        phone: true,
      },
    });

    if (existing) {
      return {
        isDuplicate: true,
        existingPatient: existing,
      };
    }

    return { isDuplicate: false };
  }
}
