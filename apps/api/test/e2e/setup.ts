/**
 * E2E Test Setup Helper
 *
 * Creates a NestJS test application with mocked PrismaService and Redis.
 * Tests the full controller→service integration flow at the HTTP layer.
 *
 * @validates Requirements 7.1-7.6, 5.1-5.5, 6.1-6.6, 8.2, 11.5
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { vi } from 'vitest';
import { PrismaService } from '../../src/database/prisma.service';
import { REDIS_CLIENT } from '../../src/modules/auth/redis.provider';

// --- Mock Prisma Service ---

export function createMockPrismaService() {
  const mock: any = {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    patient: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    clinicalNote: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    prescription: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    appointment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    signatureRecord: {
      create: vi.fn(),
    },
    fileMetadata: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    onModuleInit: vi.fn(),
    onModuleDestroy: vi.fn(),
  };

  // Make $transaction execute callback with the prisma mock itself as the "tx" proxy
  mock.$transaction.mockImplementation(async (fn: any) => {
    if (typeof fn === 'function') {
      return fn(mock);
    }
    return fn;
  });

  return mock;
}

// --- Mock Redis Client ---

export function createMockRedis() {
  const store = new Map<string, string>();
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) || null)),
    set: vi.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    del: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve(1);
    }),
    _store: store,
  };
}

// --- Test App Builder ---

export interface TestAppContext {
  app: INestApplication;
  module: TestingModule;
  prisma: ReturnType<typeof createMockPrismaService>;
  redis: ReturnType<typeof createMockRedis>;
}

export async function createTestApp(
  modules: any[],
  providers: any[] = [],
): Promise<TestAppContext> {
  const mockPrisma = createMockPrismaService();
  const mockRedis = createMockRedis();

  const moduleBuilder = Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [
          () => ({
            JWT_ACCESS_SECRET: 'test-access-secret',
            JWT_REFRESH_SECRET: 'test-refresh-secret',
            STORAGE_PATH: '/tmp/test-storage',
          }),
        ],
      }),
      JwtModule.register({
        secret: 'test-access-secret',
        signOptions: { expiresIn: '15m' },
      }),
      ...modules,
    ],
    providers: [
      ...providers,
    ],
  });

  // Override PrismaService globally
  moduleBuilder.overrideProvider(PrismaService).useValue(mockPrisma);
  moduleBuilder.overrideProvider(REDIS_CLIENT).useValue(mockRedis);

  const module = await moduleBuilder.compile();
  const app = module.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();

  return { app, module, prisma: mockPrisma, redis: mockRedis };
}

// --- Test Data Factories ---

export const testUsers = {
  doctor: {
    id: 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a',
    username: 'dr.garcia',
    role: 'doctor',
    passwordHash: '$2b$12$testHashedPassword', // bcrypt hash
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  assistant: {
    id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
    username: 'asistente.lopez',
    role: 'assistant',
    passwordHash: '$2b$12$testHashedPassword',
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  admin: {
    id: 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b',
    username: 'admin',
    role: 'admin',
    passwordHash: '$2b$12$testHashedPassword',
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  kiosk: {
    id: 'f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c',
    username: 'kiosk',
    role: 'kiosk',
    passwordHash: '$2b$12$testHashedPassword',
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
};

export const testPatient = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  fullName: 'María García López',
  birthDate: new Date('1990-05-15'),
  sex: 'F',
  phone: '5551234567',
  email: 'maria@example.com',
  address: 'Av. Reforma 123, CDMX',
  bloodType: 'O+',
  emergencyContactName: 'Juan García',
  emergencyContactPhone: '5559876543',
  emergencyContactRelationship: 'Padre',
  insuranceProvider: 'MetLife',
  insurancePolicyNumber: 'POL-123456',
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-01-15'),
};

export const testPrescription = {
  id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  patientId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  doctorId: 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a',
  assignedTo: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
  content: 'Ibuprofeno 400mg cada 8 horas por 5 días',
  status: 'pending',
  readAt: null,
  completedAt: null,
  createdAt: new Date('2024-06-15T10:30:00Z'),
  updatedAt: new Date('2024-06-15T10:30:00Z'),
};

export const testAppointment = {
  id: 'a7b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1d',
  patientId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  doctorId: 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a',
  scheduledAt: new Date(),
  reason: 'Control mensual',
  status: 'scheduled',
  createdAt: new Date('2024-06-01'),
  updatedAt: new Date('2024-06-01'),
};

export function generateAccessToken(
  jwtService: any,
  user: { id: string; role: string; username: string },
): string {
  return jwtService.sign(
    { sub: user.id, role: user.role, username: user.username },
    { secret: 'test-access-secret', expiresIn: '15m' },
  );
}
