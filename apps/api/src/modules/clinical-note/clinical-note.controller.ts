import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DEFAULT_PAGE_SIZE } from '@historial/constants';
import { ClinicalNoteService } from './clinical-note.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('patients/:patientId/notes')
export class ClinicalNoteController {
  constructor(private readonly clinicalNoteService: ClinicalNoteService) {}

  /**
   * POST /patients/:patientId/notes
   * Creates a new clinical note for the specified patient.
   * The author is extracted from the JWT token.
   *
   * @validates Requirements 4.1, 4.2
   */
  @Roles('doctor', 'admin')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body('content') content: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const note = await this.clinicalNoteService.create(
      patientId,
      user.sub,
      content,
    );
    return { data: note };
  }

  /**
   * GET /patients/:patientId/notes
   * Lists clinical notes for a patient with pagination (default 20 per page).
   * Notes are ordered by createdAt DESC (most recent first).
   *
   * @validates Requirements 4.4
   */
  @Roles('doctor', 'admin')
  @Get()
  async findByPatient(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(
      100,
      Math.max(1, parseInt(limit || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
    );

    return this.clinicalNoteService.findByPatient(patientId, pageNum, limitNum);
  }
}
