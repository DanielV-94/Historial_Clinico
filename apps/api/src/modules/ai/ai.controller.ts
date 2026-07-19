import { Controller, Post, Param } from '@nestjs/common';
import { AIService } from './ai.service';

@Controller('ai')
export class AIController {
  constructor(private readonly aiService: AIService) {}

  /**
   * Generates a structured clinical summary for a patient.
   * POST /ai/summary/:patientId
   *
   * @validates Requirements 14.1, 14.3, 14.4
   */
  @Post('summary/:patientId')
  async generateSummary(@Param('patientId') patientId: string) {
    return this.aiService.generateSummary(patientId);
  }
}
