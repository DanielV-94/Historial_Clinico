import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Logs an audit entry to the audit_logs table (append-only).
   * If the write fails, it logs the error but does NOT throw,
   * ensuring audit failure never blocks the main operation.
   */
  async log(data: CreateAuditLogDto): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: data.userId,
          userRole: data.userRole,
          action: data.action,
          entityTable: data.entityTable,
          entityId: data.entityId,
          ipAddress: data.ipAddress,
          result: data.result,
          description: data.description ?? null,
          metadata: data.metadata
            ? (data.metadata as Prisma.InputJsonValue)
            : undefined,
        },
      });
    } catch (error) {
      // Audit failure must NOT block the main operation (Requirement 8.4)
      this.logger.error(
        `Failed to write audit log: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
