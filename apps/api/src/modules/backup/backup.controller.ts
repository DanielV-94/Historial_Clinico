import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { BackupService } from './backup.service';

@Controller('backups')
@Roles('admin')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  /**
   * POST /backups/trigger
   * Manually trigger a backup (admin only)
   */
  @Post('trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerBackup() {
    const result = await this.backupService.triggerManualBackup();
    return {
      message: 'Backup triggered successfully',
      backupId: result.id,
      status: result.status,
    };
  }

  /**
   * GET /backups
   * List all backup records with pagination (admin only)
   */
  @Get()
  async listBackups(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.backupService.listBackups(pageNum, limitNum);
  }

  /**
   * GET /backups/:id/status
   * Get specific backup status (admin only)
   */
  @Get(':id/status')
  async getBackupStatus(@Param('id') id: string) {
    const record = await this.backupService.getBackupStatus(id);
    if (!record) {
      throw new NotFoundException(`Backup record with id ${id} not found`);
    }
    return record;
  }
}
