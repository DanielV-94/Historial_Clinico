import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DEFAULT_PAGE_SIZE } from '@historial/constants';
import { PatientService } from './patient.service';
import { CreatePatientDto, UpdatePatientDto } from './dto/create-patient.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('patients')
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  /**
   * GET /patients
   * Lists patients with pagination.
   * Query params: ?page=1&limit=20
   *
   * @validates Requirements 1.1, 1.2
   */
  @Roles('doctor', 'assistant', 'admin')
  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(
      100,
      Math.max(1, parseInt(limit || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
    );

    const { patients, total } = await this.patientService.findAll(pageNum, limitNum);

    return {
      data: patients,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * GET /patients/search?q=
   * Searches patients by name using trigram similarity.
   * Returns max 10 results for quick autocomplete.
   *
   * @validates Requirements 5.3
   */
  @Roles('doctor', 'admin')
  @Get('search')
  async search(@Query('q') query: string) {
    const results = await this.patientService.search(query || '');
    return { data: results };
  }

  /**
   * GET /patients/:id
   * Returns patient detail grouped by section:
   * datosGenerales, antecedentesMedicos, contactoEmergencia, seguroMedico.
   *
   * @validates Requirements 1.2
   */
  @Roles('doctor', 'assistant', 'admin')
  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.patientService.findById(id);
  }

  /**
   * POST /patients
   * Creates a new patient with validation.
   * Returns the created patient or a duplicate warning.
   *
   * @validates Requirements 1.1, 1.3, 1.4, 1.5, 1.6
   */
  @Roles('doctor', 'assistant', 'admin')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createPatientDto: CreatePatientDto) {
    return this.patientService.create(createPatientDto);
  }

  /**
   * PATCH /patients/:id
   * Updates an existing patient with partial validation.
   *
   * @validates Requirements 1.3
   */
  @Roles('doctor', 'assistant', 'admin')
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePatientDto: UpdatePatientDto,
  ) {
    return this.patientService.update(id, updatePatientDto);
  }

  /**
   * GET /patients/:id/check-duplicate
   * Verifies if a patient with the given name and birth date already exists.
   * Query params: ?name=...&birthDate=YYYY-MM-DD
   *
   * @validates Requirements 1.5
   */
  @Roles('doctor', 'assistant', 'admin')
  @Get(':id/check-duplicate')
  async checkDuplicate(
    @Query('name') name: string,
    @Query('birthDate') birthDate: string,
  ) {
    if (!name || !birthDate) {
      return { isDuplicate: false };
    }

    const result = await this.patientService.checkDuplicate(
      name,
      new Date(birthDate),
    );

    return result;
  }
}
