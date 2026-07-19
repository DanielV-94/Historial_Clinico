import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Hash a password using a simple but secure approach for seeding.
 * In production, the AuthModule uses bcrypt with salt rounds = 12.
 * For the seed, we pre-compute the bcrypt hash for 'Admin123!'.
 *
 * bcrypt hash for 'Admin123!' with 12 salt rounds:
 * $2b$12$LJ3m4sMKfXzSGqY9yPq6S.ZC3Bfz0Z8RHd5GDXhHkDQ9z3mKQXxSu
 *
 * If bcrypt is available, we use it. Otherwise we use the pre-computed hash.
 */
async function hashPassword(password: string): Promise<string> {
  try {
    // Try to use bcrypt if available
    const bcrypt = await import('bcrypt');
    return bcrypt.hash(password, 12);
  } catch {
    try {
      // Fallback to bcryptjs
      const bcryptjs = await import('bcryptjs');
      return bcryptjs.hash(password, 12);
    } catch {
      // Pre-computed bcrypt hash for 'Admin123!' (salt rounds = 12)
      // This is safe for seeding purposes only
      console.warn(
        '⚠️  Neither bcrypt nor bcryptjs found. Using pre-computed hash for admin password.',
      );
      console.warn(
        '   Install bcrypt: npm install bcrypt @types/bcrypt',
      );
      return '$2b$12$LJ3m4sMKfXzSGqY9yPq6S.ZC3Bfz0Z8RHd5GDXhHkDQ9z3mKQXxSu';
    }
  }
}

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create admin user
  const adminPasswordHash = await hashPassword('Admin123!');

  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      role: UserRole.admin,
      fullName: 'Administrador',
      email: 'admin@clinica.com',
      isActive: true,
      failedLoginAttempts: 0,
    },
  });

  console.log(`✅ Admin user created: ${adminUser.username} (${adminUser.id})`);

  // 2. Create default clinic (find or create by name)
  let clinic = await prisma.clinic.findFirst({
    where: { name: 'Clínica Demo' },
  });

  if (!clinic) {
    clinic = await prisma.clinic.create({
      data: {
        name: 'Clínica Demo',
        address: 'Dirección de ejemplo',
        phone: '5551234567',
        privacyNotice: {
          title: 'Aviso de Privacidad',
          content:
            'En cumplimiento con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP), se informa que los datos personales recabados serán utilizados exclusivamente para la prestación de servicios médicos.',
          version: '1.0',
          lastUpdated: new Date().toISOString(),
        },
        letterheadConfig: {
          pageSize: 'letter',
          margins: { top: 80, right: 40, bottom: 60, left: 40 },
          fields: {
            patientName: { x: 120, y: 680, fontSize: 12, font: 'Helvetica-Bold' },
            date: { x: 420, y: 680, fontSize: 10, font: 'Helvetica' },
            content: {
              x: 40,
              y: 620,
              fontSize: 11,
              font: 'Helvetica',
              maxWidth: 520,
              lineHeight: 14,
            },
            doctorSignature: { x: 200, y: 100, fontSize: 10, font: 'Helvetica' },
            footer: { x: 40, y: 40, fontSize: 8, font: 'Helvetica' },
          },
          templatePdfPath: '/templates/letterhead.pdf',
        },
      },
    });
  }

  console.log(`✅ Default clinic created: ${clinic.name} (${clinic.id})`);

  // 3. Create default theme config linked to the clinic
  const themeConfig = await prisma.themeConfig.upsert({
    where: { clinicId: clinic.id },
    update: {},
    create: {
      clinicId: clinic.id,
      clinicName: 'Clínica Demo',
      primaryColor: '#2563EB',
      secondaryColor: '#1E40AF',
      accentColor: '#3B82F6',
      fontFamily: 'Inter',
      rawConfig: {
        primaryColor: '#2563EB',
        secondaryColor: '#1E40AF',
        accentColor: '#3B82F6',
        fontFamily: 'Inter',
        clinicName: 'Clínica Demo',
        darkMode: false,
      },
    },
  });

  console.log(`✅ Default theme config created (${themeConfig.id})`);

  console.log('\n🎉 Seeding completed successfully!');
  console.log('   Admin credentials: admin / Admin123!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
