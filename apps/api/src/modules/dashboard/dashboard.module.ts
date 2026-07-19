import { Module } from '@nestjs/common';
import { DoctorDashboardController } from './doctor-dashboard.controller';
import { DoctorDashboardService } from './doctor-dashboard.service';
import { AssistantDashboardController } from './assistant-dashboard.controller';
import { AssistantDashboardService } from './assistant-dashboard.service';

@Module({
  controllers: [DoctorDashboardController, AssistantDashboardController],
  providers: [DoctorDashboardService, AssistantDashboardService],
  exports: [DoctorDashboardService, AssistantDashboardService],
})
export class DashboardModule {}
