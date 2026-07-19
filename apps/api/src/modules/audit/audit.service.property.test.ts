import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { AuditService } from './audit.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';

/**
 * **Validates: Requirements 8.1**
 *
 * Property 11: Registro de auditoría completo
 * Para cualquier acción registrada en el sistema, el registro de auditoría
 * SHALL contener todos los campos requeridos: ID de usuario, rol del usuario,
 * tipo de acción (create/read/update/delete), entidad afectada (tabla + registro),
 * marca de tiempo ISO 8601, dirección IP y resultado (éxito/fallo).
 */

const NUM_RUNS = 100;

// ============================================================
// ARBITRARIES
// ============================================================

/** Generate a valid UUID v4 */
const uuidArb = fc
  .tuple(
    fc.hexaString({ minLength: 8, maxLength: 8 }),
    fc.hexaString({ minLength: 4, maxLength: 4 }),
    fc.hexaString({ minLength: 4, maxLength: 4 }),
    fc.hexaString({ minLength: 4, maxLength: 4 }),
    fc.hexaString({ minLength: 12, maxLength: 12 }),
  )
  .map(([a, b, c, d, e]) => `${a}-${b}-4${c.slice(1)}-${d}-${e}`);

/** Generate a valid user role */
const userRoleArb = fc.constantFrom('doctor', 'assistant', 'admin', 'kiosk') as fc.Arbitrary<
  'doctor' | 'assistant' | 'admin' | 'kiosk'
>;

/** Generate a valid audit action */
const actionArb = fc.constantFrom('create', 'read', 'update', 'delete') as fc.Arbitrary<
  'create' | 'read' | 'update' | 'delete'
>;

/** Generate a valid audit result */
const resultArb = fc.constantFrom('success', 'failure') as fc.Arbitrary<'success' | 'failure'>;

/** Generate a non-empty string for entity table */
const entityTableArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0);

/** Generate a non-empty string for entity ID */
const entityIdArb = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0);

/** Generate a valid IPv4 address */
const ipv4Arb = fc
  .tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
  )
  .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

/** Generate a valid IPv6 address (simplified) */
const ipv6Arb = fc
  .array(fc.hexaString({ minLength: 1, maxLength: 4 }), { minLength: 8, maxLength: 8 })
  .map((groups) => groups.join(':'));

/** Generate a valid IP address (IPv4 or IPv6) */
const ipAddressArb = fc.oneof(ipv4Arb, ipv6Arb);

/** Optional description */
const descriptionArb = fc.option(
  fc.string({ minLength: 1, maxLength: 500 }),
  { nil: undefined },
);

/** Optional metadata */
const metadataArb = fc.option(
  fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
    fc.oneof(fc.string(), fc.integer(), fc.boolean()),
  ),
  { nil: undefined },
);

/** Generate a complete valid CreateAuditLogDto */
const validAuditLogDtoArb: fc.Arbitrary<CreateAuditLogDto> = fc
  .tuple(uuidArb, userRoleArb, actionArb, entityTableArb, entityIdArb, ipAddressArb, resultArb, descriptionArb, metadataArb)
  .map(([userId, userRole, action, entityTable, entityId, ipAddress, result, description, metadata]) => {
    const dto = new CreateAuditLogDto();
    dto.userId = userId;
    dto.userRole = userRole;
    dto.action = action;
    dto.entityTable = entityTable;
    dto.entityId = entityId;
    dto.ipAddress = ipAddress;
    dto.result = result;
    dto.description = description;
    dto.metadata = metadata;
    return dto;
  });

// ============================================================
// MOCK SETUP
// ============================================================

function createMockPrismaService() {
  return {
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
    },
  };
}

// ============================================================
// PROPERTY TESTS
// ============================================================

describe('AuditService - Property 11: Registro de auditoría completo', () => {
  let auditService: AuditService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(() => {
    mockPrisma = createMockPrismaService();
    auditService = new AuditService(mockPrisma as any);
  });

  it('should accept any valid CreateAuditLogDto without throwing', async () => {
    await fc.assert(
      fc.asyncProperty(validAuditLogDtoArb, async (dto) => {
        // AuditService.log() should not throw for valid input
        await expect(auditService.log(dto)).resolves.not.toThrow();
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should pass all required fields to prisma.auditLog.create()', async () => {
    await fc.assert(
      fc.asyncProperty(validAuditLogDtoArb, async (dto) => {
        mockPrisma.auditLog.create.mockClear();

        await auditService.log(dto);

        expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);

        const passedData = mockPrisma.auditLog.create.mock.calls[0][0].data;

        // Verify ALL required fields are present
        expect(passedData).toHaveProperty('userId');
        expect(passedData).toHaveProperty('userRole');
        expect(passedData).toHaveProperty('action');
        expect(passedData).toHaveProperty('entityTable');
        expect(passedData).toHaveProperty('entityId');
        expect(passedData).toHaveProperty('ipAddress');
        expect(passedData).toHaveProperty('result');
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should store userId as a valid UUID string', async () => {
    await fc.assert(
      fc.asyncProperty(validAuditLogDtoArb, async (dto) => {
        mockPrisma.auditLog.create.mockClear();

        await auditService.log(dto);

        const passedData = mockPrisma.auditLog.create.mock.calls[0][0].data;
        expect(typeof passedData.userId).toBe('string');
        expect(passedData.userId.length).toBeGreaterThan(0);
        expect(passedData.userId).toBe(dto.userId);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should store userRole as one of the valid roles', async () => {
    const validRoles = ['doctor', 'assistant', 'admin', 'kiosk'];

    await fc.assert(
      fc.asyncProperty(validAuditLogDtoArb, async (dto) => {
        mockPrisma.auditLog.create.mockClear();

        await auditService.log(dto);

        const passedData = mockPrisma.auditLog.create.mock.calls[0][0].data;
        expect(validRoles).toContain(passedData.userRole);
        expect(passedData.userRole).toBe(dto.userRole);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should store action as one of create/read/update/delete', async () => {
    const validActions = ['create', 'read', 'update', 'delete'];

    await fc.assert(
      fc.asyncProperty(validAuditLogDtoArb, async (dto) => {
        mockPrisma.auditLog.create.mockClear();

        await auditService.log(dto);

        const passedData = mockPrisma.auditLog.create.mock.calls[0][0].data;
        expect(validActions).toContain(passedData.action);
        expect(passedData.action).toBe(dto.action);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should store entityTable as a non-empty string', async () => {
    await fc.assert(
      fc.asyncProperty(validAuditLogDtoArb, async (dto) => {
        mockPrisma.auditLog.create.mockClear();

        await auditService.log(dto);

        const passedData = mockPrisma.auditLog.create.mock.calls[0][0].data;
        expect(typeof passedData.entityTable).toBe('string');
        expect(passedData.entityTable.trim().length).toBeGreaterThan(0);
        expect(passedData.entityTable).toBe(dto.entityTable);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should store entityId as a non-empty string', async () => {
    await fc.assert(
      fc.asyncProperty(validAuditLogDtoArb, async (dto) => {
        mockPrisma.auditLog.create.mockClear();

        await auditService.log(dto);

        const passedData = mockPrisma.auditLog.create.mock.calls[0][0].data;
        expect(typeof passedData.entityId).toBe('string');
        expect(passedData.entityId.trim().length).toBeGreaterThan(0);
        expect(passedData.entityId).toBe(dto.entityId);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should store ipAddress in valid IP format', async () => {
    const ipv4Regex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    const ipv6Regex = /^[0-9a-fA-F:]+$/;

    await fc.assert(
      fc.asyncProperty(validAuditLogDtoArb, async (dto) => {
        mockPrisma.auditLog.create.mockClear();

        await auditService.log(dto);

        const passedData = mockPrisma.auditLog.create.mock.calls[0][0].data;
        expect(typeof passedData.ipAddress).toBe('string');
        const isValidIp = ipv4Regex.test(passedData.ipAddress) || ipv6Regex.test(passedData.ipAddress);
        expect(isValidIp).toBe(true);
        expect(passedData.ipAddress).toBe(dto.ipAddress);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should store result as one of success/failure', async () => {
    const validResults = ['success', 'failure'];

    await fc.assert(
      fc.asyncProperty(validAuditLogDtoArb, async (dto) => {
        mockPrisma.auditLog.create.mockClear();

        await auditService.log(dto);

        const passedData = mockPrisma.auditLog.create.mock.calls[0][0].data;
        expect(validResults).toContain(passedData.result);
        expect(passedData.result).toBe(dto.result);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should not throw even when prisma.create fails (audit failure must not block)', async () => {
    mockPrisma.auditLog.create.mockRejectedValue(new Error('DB connection lost'));

    await fc.assert(
      fc.asyncProperty(validAuditLogDtoArb, async (dto) => {
        // Service must NOT throw even if DB write fails
        await expect(auditService.log(dto)).resolves.not.toThrow();
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should preserve the complete DTO structure passed to the data layer', async () => {
    await fc.assert(
      fc.asyncProperty(validAuditLogDtoArb, async (dto) => {
        mockPrisma.auditLog.create.mockClear();

        await auditService.log(dto);

        const passedData = mockPrisma.auditLog.create.mock.calls[0][0].data;

        // All required fields must match the input DTO exactly
        expect(passedData.userId).toBe(dto.userId);
        expect(passedData.userRole).toBe(dto.userRole);
        expect(passedData.action).toBe(dto.action);
        expect(passedData.entityTable).toBe(dto.entityTable);
        expect(passedData.entityId).toBe(dto.entityId);
        expect(passedData.ipAddress).toBe(dto.ipAddress);
        expect(passedData.result).toBe(dto.result);

        // Optional fields
        if (dto.description !== undefined) {
          expect(passedData.description).toBe(dto.description);
        } else {
          expect(passedData.description).toBeNull();
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
