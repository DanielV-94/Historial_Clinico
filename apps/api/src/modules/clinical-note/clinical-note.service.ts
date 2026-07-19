import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { clinicalNoteContentSchema } from '@historial/validators';
import { DEFAULT_PAGE_SIZE } from '@historial/constants';
import { PrismaService } from '../../database/prisma.service';

export interface PaginatedNotesResult {
  data: {
    id: string;
    patientId: string;
    authorId: string;
    content: string;
    createdAt: Date;
  }[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class ClinicalNoteService {
  private readonly logger = new Logger(ClinicalNoteService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new clinical note for a patient.
   * Validates content length (1–10,000 chars) using shared Zod schema.
   * Notes are immutable once created (no update/delete).
   *
   * @validates Requirements 4.1, 4.2
   */
  async create(patientId: string, authorId: string, content: string) {
    // Validate content using shared schema
    const validation = clinicalNoteContentSchema.safeParse(content);
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => ({
        field: 'content',
        message: e.message,
      }));
      throw new BadRequestException({
        message: 'Validación fallida',
        errors,
      });
    }

    const note = await this.prisma.clinicalNote.create({
      data: {
        patientId,
        authorId,
        content,
      },
    });

    this.logger.log(
      `Clinical note created: ${note.id} for patient ${patientId} by author ${authorId}`,
    );

    return note;
  }

  /**
   * Finds clinical notes for a patient with pagination, ordered by createdAt DESC.
   * Uses the index on (patientId, createdAt DESC) for efficient queries.
   *
   * @validates Requirements 4.4
   */
  async findByPatient(
    patientId: string,
    page: number = 1,
    limit: number = DEFAULT_PAGE_SIZE,
  ): Promise<PaginatedNotesResult> {
    const skip = (page - 1) * limit;

    const [notes, total] = await Promise.all([
      this.prisma.clinicalNote.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.clinicalNote.count({
        where: { patientId },
      }),
    ]);

    return {
      data: notes,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
