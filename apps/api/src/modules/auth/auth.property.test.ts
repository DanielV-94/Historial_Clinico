import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { passwordSchema } from '@historial/validators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthService } from './auth.service';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

/**
 * Property-Based Tests for Authentication Module.
 *
 * **Validates: Requirements 13.1, 13.2, 13.4, 13.5, 8.3**
 */

const NUM_RUNS = 100;

// ============================================================
// ARBITRARIES
// ============================================================

// --- Property 16: Password Validation ---

/** Generate a valid password: 8+ chars with at least 1 uppercase, 1 lowercase, 1 digit */
const validPasswordArb = fc
  .tuple(
    fc.string({ minLength: 5, maxLength: 50, unit: 'grapheme' }).map((s) =>
      // Strip out non-ASCII to keep things simple
      s.replace(/[^a-zA-Z0-9!@#$%^&*()_+\-=[\]{};':"|,.<>/?`~ ]/g, 'x'),
    ),
    fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'Z'),
    fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'z'),
    fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
  )
  .map(([base, upper, lower, digit]) => {
    // Ensure minimum length of 8 by padding
    const core = `${upper}${lower}${digit}`;
    const padding = base.slice(0, Math.max(5, 50 - core.length));
    return `${core}${padding}`;
  })
  .filter((pwd) => pwd.length >= 8);

/** Generate invalid passwords: too short (< 8 chars) */
const tooShortPasswordArb = fc
  .string({ minLength: 1, maxLength: 7 })
  .filter((s) => s.length >= 1 && s.length < 8);

/** Generate invalid passwords: missing uppercase */
const noUppercasePasswordArb = fc
  .tuple(
    fc.stringMatching(/^[a-z0-9]{8,30}$/),
  )
  .map(([pwd]) => pwd)
  .filter((pwd) => pwd.length >= 8 && !/[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[0-9]/.test(pwd));

/** Generate invalid passwords: missing lowercase */
const noLowercasePasswordArb = fc
  .tuple(
    fc.stringMatching(/^[A-Z0-9]{8,30}$/),
  )
  .map(([pwd]) => pwd)
  .filter((pwd) => pwd.length >= 8 && /[A-Z]/.test(pwd) && !/[a-z]/.test(pwd) && /[0-9]/.test(pwd));

/** Generate invalid passwords: missing digit */
const noDigitPasswordArb = fc
  .tuple(
    fc.stringMatching(/^[a-zA-Z]{8,30}$/),
  )
  .map(([pwd]) => pwd)
  .filter((pwd) => pwd.length >= 8 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && !/[0-9]/.test(pwd));


// --- Property 17: Account Lockout ---

/** Generate number of failed attempts that should trigger lockout (>= 5) */
const lockoutAttemptsArb = fc.integer({ min: 5, max: 100 });

/** Generate number of failed attempts that should NOT trigger lockout (< 5) */
const safeLAttemptsArb = fc.integer({ min: 0, max: 4 });


// --- Property 12: RBAC ---

type UserRole = 'doctor' | 'assistant' | 'admin' | 'kiosk';

const allRoles: UserRole[] = ['doctor', 'assistant', 'admin', 'kiosk'];
const userRoleArb = fc.constantFrom(...allRoles);

/**
 * RBAC Matrix per design spec:
 * - Doctor:    allowed for endpoints requiring ['doctor', 'admin'] or roles including 'doctor'
 * - Assistant: allowed for endpoints requiring ['assistant', 'admin'] or roles including 'assistant'
 * - Admin:     allowed for ALL endpoints (admin is always in requiredRoles)
 * - Kiosk:     allowed only for endpoints requiring ['kiosk'] or roles including 'kiosk'
 *
 * The RolesGuard checks: requiredRoles.includes(user.role)
 * So: access is granted iff user.role is in the requiredRoles array.
 */

/** Generate non-empty required roles arrays */
const requiredRolesArb = fc
  .subarray(allRoles, { minLength: 1, maxLength: 4 })
  .filter((arr) => arr.length > 0);

// ============================================================
// MOCK HELPERS
// ============================================================

/** Mock bcrypt */
vi.mock('bcrypt', () => ({
  default: { compare: vi.fn() },
  compare: vi.fn(),
}));

vi.mock('uuid', () => ({
  v4: () => 'mock-uuid-token-id',
}));

import * as bcrypt from 'bcrypt';

function createMockPrismaService() {
  return {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
}

function createMockJwtService() {
  return {
    sign: vi.fn().mockReturnValue('mock-jwt-token'),
    verify: vi.fn(),
  };
}

function createMockConfigService() {
  return {
    get: vi.fn((key: string) => {
      const config: Record<string, string> = {
        JWT_ACCESS_SECRET: 'test-access-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
      };
      return config[key];
    }),
  };
}

function createMockRedis() {
  return {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn(),
    del: vi.fn().mockResolvedValue(1),
  };
}

/** Create a mock ExecutionContext for RolesGuard testing */
function createMockExecutionContext(user: { sub: string; role: string; username: string } | undefined) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

// ============================================================
// PROPERTY TESTS
// ============================================================

describe('Auth Property Tests - Property 16: Validación de contraseña', () => {
  /**
   * **Validates: Requirements 13.1**
   *
   * Property 16: Para cualquier string de contraseña, la validación SHALL aceptarlo
   * si y solo si tiene mínimo 8 caracteres e incluye al menos una letra mayúscula,
   * una minúscula y un número.
   */

  it('should ACCEPT any password with 8+ chars, ≥1 uppercase, ≥1 lowercase, ≥1 digit', () => {
    fc.assert(
      fc.property(validPasswordArb, (password) => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should REJECT any password shorter than 8 characters', () => {
    fc.assert(
      fc.property(tooShortPasswordArb, (password) => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(false);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should REJECT any password missing an uppercase letter', () => {
    fc.assert(
      fc.property(noUppercasePasswordArb, (password) => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(false);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should REJECT any password missing a lowercase letter', () => {
    fc.assert(
      fc.property(noLowercasePasswordArb, (password) => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(false);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should REJECT any password missing a digit', () => {
    fc.assert(
      fc.property(noDigitPasswordArb, (password) => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(false);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Auth Property Tests - Property 17: Bloqueo de cuenta por intentos fallidos', () => {
  /**
   * **Validates: Requirements 13.4**
   *
   * Property 17: Para cualquier secuencia de N intentos de login fallidos consecutivos,
   * si N >= 5 el sistema SHALL bloquear la cuenta; si N < 5 la cuenta SHALL permanecer activa.
   */

  let authService: AuthService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockJwt: ReturnType<typeof createMockJwtService>;
  let mockConfig: ReturnType<typeof createMockConfigService>;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    mockPrisma = createMockPrismaService();
    mockJwt = createMockJwtService();
    mockConfig = createMockConfigService();
    mockRedis = createMockRedis();

    authService = new AuthService(
      mockPrisma as any,
      mockJwt as any,
      mockConfig as any,
      mockRedis as any,
    );
  });

  it('should LOCK account when failed attempts reach 5 or more (N >= 5 triggers lockout)', async () => {
    await fc.assert(
      fc.asyncProperty(lockoutAttemptsArb, async (totalAttempts) => {
        // Simulate a user who already has (totalAttempts - 1) failed attempts
        // and is about to fail one more time, reaching totalAttempts
        const currentAttempts = totalAttempts - 1;

        const mockUser = {
          id: 'user-lock-test',
          username: 'testuser',
          passwordHash: '$2b$12$hashed',
          role: 'doctor',
          fullName: 'Test User',
          email: 'test@clinic.com',
          isActive: true,
          failedLoginAttempts: currentAttempts,
          lockedUntil: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrisma.user.findUnique.mockResolvedValue(mockUser);
        (bcrypt.compare as any).mockResolvedValue(false);
        mockPrisma.user.update.mockResolvedValue(mockUser);

        try {
          await authService.login('testuser', 'wrongpassword');
        } catch {
          // Expected to throw UnauthorizedException
        }

        // Verify update was called with lockedUntil set
        expect(mockPrisma.user.update).toHaveBeenCalledWith({
          where: { id: 'user-lock-test' },
          data: expect.objectContaining({
            failedLoginAttempts: totalAttempts,
            lockedUntil: expect.any(Date),
          }),
        });
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should NOT lock account when failed attempts are below 5 (N < 5)', async () => {
    await fc.assert(
      fc.asyncProperty(safeLAttemptsArb, async (currentAttempts) => {
        // The new total will be currentAttempts + 1, which is at most 5.
        // But lockout only triggers at >= 5 (the 5th attempt).
        // With currentAttempts 0..4, the new total is 1..5.
        // When currentAttempts = 4 (new total = 5), it DOES lock.
        // So we only test currentAttempts 0..3 here for "should NOT lock".
        if (currentAttempts >= 4) return; // skip edge case where total would be 5

        const mockUser = {
          id: 'user-safe-test',
          username: 'testuser',
          passwordHash: '$2b$12$hashed',
          role: 'doctor',
          fullName: 'Test User',
          email: 'test@clinic.com',
          isActive: true,
          failedLoginAttempts: currentAttempts,
          lockedUntil: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrisma.user.findUnique.mockResolvedValue(mockUser);
        (bcrypt.compare as any).mockResolvedValue(false);
        mockPrisma.user.update.mockResolvedValue(mockUser);

        try {
          await authService.login('testuser', 'wrongpassword');
        } catch {
          // Expected to throw UnauthorizedException
        }

        // Verify update was called WITHOUT lockedUntil
        expect(mockPrisma.user.update).toHaveBeenCalledWith({
          where: { id: 'user-safe-test' },
          data: {
            failedLoginAttempts: currentAttempts + 1,
          },
        });
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should set lockedUntil to approximately 15 minutes in the future when locking', async () => {
    await fc.assert(
      fc.asyncProperty(lockoutAttemptsArb, async (totalAttempts) => {
        const currentAttempts = totalAttempts - 1;

        const mockUser = {
          id: 'user-time-test',
          username: 'testuser',
          passwordHash: '$2b$12$hashed',
          role: 'doctor',
          fullName: 'Test User',
          email: 'test@clinic.com',
          isActive: true,
          failedLoginAttempts: currentAttempts,
          lockedUntil: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrisma.user.findUnique.mockResolvedValue(mockUser);
        (bcrypt.compare as any).mockResolvedValue(false);
        mockPrisma.user.update.mockResolvedValue(mockUser);

        const beforeTime = Date.now();

        try {
          await authService.login('testuser', 'wrongpassword');
        } catch {
          // Expected
        }

        const afterTime = Date.now();

        const updateCall = mockPrisma.user.update.mock.calls[0][0];
        const lockedUntil = updateCall.data.lockedUntil as Date;
        
        expect(lockedUntil).toBeInstanceOf(Date);
        
        // lockedUntil should be ~15 minutes from now (within a tolerance)
        const lockDuration = lockedUntil.getTime() - beforeTime;
        const fifteenMinMs = 15 * 60 * 1000;
        const tolerance = afterTime - beforeTime + 1000; // execution time tolerance
        
        expect(lockDuration).toBeGreaterThanOrEqual(fifteenMinMs - tolerance);
        expect(lockDuration).toBeLessThanOrEqual(fifteenMinMs + tolerance);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Auth Property Tests - Property 12: Control de acceso basado en roles (RBAC)', () => {
  /**
   * **Validates: Requirements 8.3, 13.2, 13.5**
   *
   * Property 12: Para cualquier combinación de (rol de usuario, endpoint/módulo),
   * el sistema SHALL permitir el acceso si y solo si la combinación está autorizada.
   * Admin always passes. Other roles only pass if their role is in requiredRoles.
   */

  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
  });

  it('should ALLOW access when user role is included in required roles', () => {
    fc.assert(
      fc.property(userRoleArb, requiredRolesArb, (userRole, requiredRoles) => {
        // Only test cases where userRole IS in requiredRoles
        if (!requiredRoles.includes(userRole)) return; // skip non-matching cases

        // Mock reflector to return the required roles
        vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
          if (key === IS_PUBLIC_KEY) return false;
          if (key === ROLES_KEY) return requiredRoles;
          return undefined;
        });

        const context = createMockExecutionContext({
          sub: 'user-123',
          role: userRole,
          username: 'testuser',
        });

        const result = rolesGuard.canActivate(context);
        expect(result).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should DENY access when user role is NOT in required roles', () => {
    fc.assert(
      fc.property(userRoleArb, requiredRolesArb, (userRole, requiredRoles) => {
        // Only test cases where userRole is NOT in requiredRoles
        if (requiredRoles.includes(userRole)) return; // skip matching cases

        vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
          if (key === IS_PUBLIC_KEY) return false;
          if (key === ROLES_KEY) return requiredRoles;
          return undefined;
        });

        const context = createMockExecutionContext({
          sub: 'user-123',
          role: userRole,
          username: 'testuser',
        });

        expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should ALWAYS allow admin when admin is in required roles', () => {
    fc.assert(
      fc.property(requiredRolesArb, (requiredRoles) => {
        // Ensure admin is in required roles (as per RBAC matrix: admin accesses ALL)
        const rolesWithAdmin = requiredRoles.includes('admin')
          ? requiredRoles
          : [...requiredRoles, 'admin' as UserRole];

        vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
          if (key === IS_PUBLIC_KEY) return false;
          if (key === ROLES_KEY) return rolesWithAdmin;
          return undefined;
        });

        const context = createMockExecutionContext({
          sub: 'admin-123',
          role: 'admin',
          username: 'admin',
        });

        const result = rolesGuard.canActivate(context);
        expect(result).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should DENY access when no user is present on request (fail-closed)', () => {
    fc.assert(
      fc.property(requiredRolesArb, (requiredRoles) => {
        vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
          if (key === IS_PUBLIC_KEY) return false;
          if (key === ROLES_KEY) return requiredRoles;
          return undefined;
        });

        const context = createMockExecutionContext(undefined);

        expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should ALLOW access to any authenticated user when no roles are required', () => {
    fc.assert(
      fc.property(userRoleArb, (userRole) => {
        vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
          if (key === IS_PUBLIC_KEY) return false;
          if (key === ROLES_KEY) return undefined; // No roles specified
          return undefined;
        });

        const context = createMockExecutionContext({
          sub: 'user-123',
          role: userRole,
          username: 'testuser',
        });

        const result = rolesGuard.canActivate(context);
        expect(result).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('should verify the complete RBAC matrix: each role only accesses its authorized endpoints', () => {
    /**
     * The RBAC matrix from design:
     * - Doctor endpoints require: ['doctor', 'admin']
     * - Assistant endpoints require: ['assistant', 'admin']
     * - Admin endpoints require: ['admin']
     * - Kiosk endpoints require: ['kiosk']
     * - Patient read (for assistant): ['doctor', 'assistant', 'admin']
     */
    const rbacMatrix: Array<{ endpointName: string; requiredRoles: UserRole[]; allowedRoles: UserRole[] }> = [
      { endpointName: 'patient-write', requiredRoles: ['doctor', 'admin'], allowedRoles: ['doctor', 'admin'] },
      { endpointName: 'dashboard-doctor', requiredRoles: ['doctor', 'admin'], allowedRoles: ['doctor', 'admin'] },
      { endpointName: 'ai-summary', requiredRoles: ['doctor', 'admin'], allowedRoles: ['doctor', 'admin'] },
      { endpointName: 'assistant-dashboard', requiredRoles: ['assistant', 'admin'], allowedRoles: ['assistant', 'admin'] },
      { endpointName: 'patient-read', requiredRoles: ['doctor', 'assistant', 'admin'], allowedRoles: ['doctor', 'assistant', 'admin'] },
      { endpointName: 'admin-only', requiredRoles: ['admin'], allowedRoles: ['admin'] },
      { endpointName: 'kiosk', requiredRoles: ['kiosk'], allowedRoles: ['kiosk'] },
    ];

    fc.assert(
      fc.property(
        userRoleArb,
        fc.constantFrom(...rbacMatrix),
        (userRole, endpoint) => {
          vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
            if (key === IS_PUBLIC_KEY) return false;
            if (key === ROLES_KEY) return endpoint.requiredRoles;
            return undefined;
          });

          const context = createMockExecutionContext({
            sub: 'user-123',
            role: userRole,
            username: 'testuser',
          });

          const shouldAllow = endpoint.allowedRoles.includes(userRole);

          if (shouldAllow) {
            const result = rolesGuard.canActivate(context);
            expect(result).toBe(true);
          } else {
            expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
