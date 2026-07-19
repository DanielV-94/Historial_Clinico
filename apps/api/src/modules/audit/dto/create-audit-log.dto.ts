import { AuditAction, AuditResult, UserRole } from '@prisma/client';

export class CreateAuditLogDto {
  userId!: string;
  userRole!: UserRole;
  action!: AuditAction;
  entityTable!: string;
  entityId!: string;
  ipAddress!: string;
  result!: AuditResult;
  description?: string;
  metadata?: Record<string, unknown>;
}
