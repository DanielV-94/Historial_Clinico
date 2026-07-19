import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuditModule } from './modules/audit';
import { AuthModule } from './modules/auth/auth.module';
import { PatientModule } from './modules/patient';
import { FileModule } from './modules/file';
import { ClinicalNoteModule } from './modules/clinical-note';
import { PrescriptionModule } from './modules/prescription';
import { DashboardModule } from './modules/dashboard';
import { PDFModule } from './modules/pdf';
import { BackupModule } from './modules/backup';
import { ThemeModule } from './modules/theme';
import { KioskModule } from './modules/kiosk';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { InactivityGuard } from './modules/auth/guards/inactivity.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    AuditModule,
    AuthModule,
    PatientModule,
    FileModule,
    ClinicalNoteModule,
    PrescriptionModule,
    DashboardModule,
    PDFModule,
    BackupModule,
    ThemeModule,
    KioskModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global guards — execution order: JwtAuthGuard → InactivityGuard → RolesGuard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: InactivityGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
