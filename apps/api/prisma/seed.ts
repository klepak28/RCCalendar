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
    { name: 'Standard cleaning', priceCents: 15000 },
    { name: 'Deep cleaning', priceCents: 25000 },
    { name: 'Move out cleaning', priceCents: 35000 },
    { name: 'Window cleaning', priceCents: 12000 },
  ];
  for (const s of services) {
    const exists = await prisma.service.findFirst({ where: { name: s.name } });
    if (!exists) await prisma.service.create({ data: s });
  }
  console.log('Seeded services');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
