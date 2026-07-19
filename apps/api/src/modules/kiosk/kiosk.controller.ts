import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Sse,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';

import { Public } from '../../common/decorators/public.decorator';
import { KioskService } from './kiosk.service';
import { KioskRegisterDto } from './dto/kiosk-register.dto';

/**
 * Kiosk controller for patient self-registration.
 * All endpoints are public (kiosk device has physical access control).
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */
@Controller('kiosk')
export class KioskController {
  constructor(private readonly kioskService: KioskService) {}

  /**
   * POST /kiosk/register
   * Registers a new patient from the kiosk wizard.
   * Receives all patient data + base64 signature image.
   * Returns created patient ID on success, 409 on duplicate.
   *
   * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.6
   */
  @Public()
  @Post('register')
  async register(
    @Body() body: KioskRegisterDto,
    @Req() req: Request,
  ): Promise<{ patientId: string; message: string }> {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) ||
      req.socket.remoteAddress ||
      'unknown';

    return this.kioskService.register(body, ipAddress);
  }

  /**
   * GET /kiosk/privacy-notice
   * Returns the clinic's privacy notice text (LFPDPPP compliance).
   * Scrollable text displayed before signature step.
   *
   * Validates: Requirement 7.2
   */
  @Public()
  @Get('privacy-notice')
  async getPrivacyNotice(): Promise<{ title: string; content: string }> {
    return this.kioskService.getPrivacyNotice();
  }

  /**
   * POST /kiosk/session/start
   * Starts a new kiosk session with inactivity timeout tracking.
   * Returns session ID and timeout value for frontend idle detection.
   *
   * Validates: Requirement 7.5
   */
  @Public()
  @Post('session/start')
  startSession(): { sessionId: string; timeoutMs: number } {
    return this.kioskService.startSession();
  }

  /**
   * POST /kiosk/session/heartbeat
   * Refreshes the inactivity timer for an active session.
   * Called periodically by the frontend when user is active.
   *
   * Validates: Requirement 7.5
   */
  @Public()
  @Post('session/heartbeat')
  refreshSession(@Body('sessionId') sessionId: string): { active: boolean } {
    const active = this.kioskService.refreshSession(sessionId);
    return { active };
  }

  /**
   * GET /kiosk/events
   * SSE stream for reception to receive new registration notifications.
   * Emits events when a patient completes kiosk registration.
   *
   * Validates: Requirement 7.3
   */
  @Public()
  @Sse('events')
  registrationEvents(): Observable<MessageEvent> {
    return this.kioskService.getRegistrationEventStream();
  }
}
