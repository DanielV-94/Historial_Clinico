import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { Request } from 'express';
import { AuditAction, AuditResult, UserRole } from '@prisma/client';
import { AuditService } from './audit.service';

/** Maps HTTP methods to audit actions */
function mapHttpMethodToAction(method: string): AuditAction {
  switch (method.toUpperCase()) {
    case 'POST':
      return 'create';
    case 'GET':
      return 'read';
    case 'PATCH':
    case 'PUT':
      return 'update';
    case 'DELETE':
      return 'delete';
    default:
      return 'read';
  }
}

/** Extracts client IP from request, handling proxied requests */
function extractIpAddress(request: Request): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return request.ip || request.socket?.remoteAddress || 'unknown';
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;
    const action = mapHttpMethodToAction(method);
    const ipAddress = extractIpAddress(request);

    // Extract user info from JWT payload (set by auth guards)
    const user = (request as any).user;
    const userId: string = user?.sub || user?.userId || 'anonymous';
    const userRole: UserRole = user?.role || 'admin';

    // Extract entity info from route params
    const params = request.params || {};
    const entityId = params.id || params.docId || params.patientId || '';
    const entityTable = this.extractEntityTable(request.path);

    return next.handle().pipe(
      tap(() => {
        // Log success after handler executes
        this.auditService.log({
          userId,
          userRole,
          action,
          entityTable,
          entityId,
          ipAddress,
          result: 'success' as AuditResult,
          description: `${method} ${request.path}`,
          metadata: {
            controller: context.getClass()?.name,
            handler: context.getHandler()?.name,
          },
        });
      }),
      catchError((error) => {
        // Log failure but DON'T suppress the error
        this.auditService.log({
          userId,
          userRole,
          action,
          entityTable,
          entityId,
          ipAddress,
          result: 'failure' as AuditResult,
          description: `${method} ${request.path} — ${error?.message || 'Unknown error'}`,
          metadata: {
            controller: context.getClass()?.name,
            handler: context.getHandler()?.name,
            errorName: error?.name,
          },
        });

        return throwError(() => error);
      }),
    );
  }

  /**
   * Attempts to extract a meaningful entity table name from the URL path.
   * E.g., /api/patients/123 → "patients", /api/prescriptions/456/pdf → "prescriptions"
   */
  private extractEntityTable(path: string): string {
    // Remove leading /api/ prefix if present
    const cleanPath = path.replace(/^\/api\//, '').replace(/^\//, '');
    // Take the first segment as the entity table
    const firstSegment = cleanPath.split('/')[0];
    return firstSegment || 'unknown';
  }
}
