import { Controller, Get } from '@nestjs/common';
import { AssistantDashboardService } from './assistant-dashboard.service';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('dashboard/assistant')
export class AssistantDashboardController {
  constructor(
    private readonly assistantDashboardService: AssistantDashboardService,
  ) {}

  /**
   * GET /dashboard/assistant/today
   * Returns today's appointments with materials/insumos list per appointment.
   * Appointments are ordered by time ASC and include patient name, reason, and materials.
   * Not filtered by specific assistant — shows ALL appointments for today.
   *
   * @validates Requirements 6.1
   */
  @Roles('assistant', 'admin')
  @Get('today')
  async getTodayAppointments() {
    const result = await this.assistantDashboardService.getTodayAppointments();
    return { data: result };
  }
}
