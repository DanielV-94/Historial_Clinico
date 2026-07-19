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
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { DEFAULT_PAGE_SIZE } from '@historial/constants';
import { PrescriptionService } from './prescription.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('prescriptions')
export class PrescriptionController {
  constructor(private readonly prescriptionService: PrescriptionService) {}

  /**
   * POST /prescriptions
   * Creates a new prescription and sends it to the assigned assistant's inbox.
   * Emits an SSE event for real-time notification (≤3 seconds).
   *
   * @validates Requirements 4.3, 4.5
   */
  @Roles('doctor', 'admin')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() body: { patientId: string; content: string; assignedTo: string },
    @CurrentUser() user: JwtPayload,
  ) {
    const prescription = await this.prescriptionService.create(
      user.sub,
      body.patientId,
      body.content,
      body.assignedTo,
    );
    return { data: prescription };
  }

  /**
   * POST /prescriptions/:id/retry
   * Retries delivery of a prescription notification to the assigned assistant.
   * Used when the initial SSE delivery failed.
   *
   * @validates Requirements 4.5
   */
  @Roles('doctor', 'admin')
  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  async retryDelivery(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.prescriptionService.retryDelivery(id, user.sub);
  }

  /**
   * GET /prescriptions/inbox
   * Returns the prescription inbox for the authenticated assistant.
   * Paginated, ordered by createdAt DESC, with read/unread status.
   *
   * @validates Requirements 6.3
   */
  @Roles('assistant', 'admin')
  @Get('inbox')
  async getInbox(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(
      100,
      Math.max(1, parseInt(limit || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
    );

    return this.prescriptionService.getInbox(user.sub, pageNum, limitNum);
  }

  /**
   * PATCH /prescriptions/:id/read
   * Marks a prescription as read by the authenticated assistant.
   * Updates status: pending → read, sets readAt timestamp.
   *
   * @validates Requirements 6.3
   */
  @Roles('assistant', 'admin')
  @Patch(':id/read')
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const prescription = await this.prescriptionService.markAsRead(id, user.sub);
    return { data: prescription };
  }

  /**
   * PATCH /prescriptions/:id/complete
   * Marks a prescription as completed by the authenticated assistant.
   * Updates status to 'completed', sets completedAt timestamp.
   * Archives the prescription out of the active inbox.
   *
   * @validates Requirements 6.6
   */
  @Roles('assistant', 'admin')
  @Patch(':id/complete')
  async markAsCompleted(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const prescription = await this.prescriptionService.markAsCompleted(id, user.sub);
    return { data: prescription };
  }

  /**
   * GET /prescriptions/events
   * SSE endpoint for real-time prescription notifications.
   * Each assistant receives only events assigned to them.
   * Uses NestJS @Sse() decorator for proper Server-Sent Events handling.
   *
   * @validates Requirements 4.3 (notification ≤3 seconds)
   */
  @Roles('assistant', 'admin')
  @Sse('events')
  events(@CurrentUser() user: JwtPayload): Observable<MessageEvent> {
    return this.prescriptionService.getEventStream(user.sub);
  }
}
