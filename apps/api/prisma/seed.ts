import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const defaultPassword = bcrypt.hashSync('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: defaultPassword,
      timezone: 'America/Chicago',
    },
  });
  console.log('Seeded user:', admin.username);

  const services = [
    'Standard cleaning',
    'Deep cleaning',
    'Move out cleaning',
    'Window cleaning',
  ];
  for (const name of services) {
    await prisma.service.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log('Seeded services');
  // Teams: seed creates 0 teams by default
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
