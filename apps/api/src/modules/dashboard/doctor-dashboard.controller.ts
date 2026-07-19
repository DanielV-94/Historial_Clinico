import { Controller, Get } from '@nestjs/common';
import { DoctorDashboardService } from './doctor-dashboard.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('dashboard/doctor')
export class DoctorDashboardController {
  constructor(private readonly doctorDashboardService: DoctorDashboardService) {}

  /**
   * GET /dashboard/doctor/today
   * Returns today's appointments for the authenticated doctor, ordered by time ASC.
   * Includes patient name, appointment reason, and status.
   * Returns allCompleted flag when all appointments are done.
   *
   * @validates Requirements 5.1, 5.4, 5.5
   */
  @Roles('doctor', 'admin')
  @Get('today')
  async getTodayAppointments(@CurrentUser() user: JwtPayload) {
    const result = await this.doctorDashboardService.getTodayAppointments(user.sub);
    return { data: result };
  }

  /**
   * GET /dashboard/doctor/next-patient
   * Returns the next patient card for the authenticated doctor.
   * Includes: fullName, profilePhotoPath, last procedure, appointment reason, allergies.
   * Returns null data if no upcoming appointments or all completed.
   *
   * @validates Requirements 5.2, 5.4, 5.5
   */
  @Roles('doctor', 'admin')
  @Get('next-patient')
  async getNextPatient(@CurrentUser() user: JwtPayload) {
    const result = await this.doctorDashboardService.getNextPatient(user.sub);
    return { data: result };
  }
}
