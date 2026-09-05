import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    UPDATE offers SET "iconName" = 'bird' WHERE id = 'seed-early-bird-offer';
  `);
  console.log('Updated seed-early-bird-offer iconName to bird');

  const rows = await prisma.$queryRawUnsafe(`SELECT id, title, "iconName" FROM offers`);
  console.log('Current offers in DB:', rows);
}

main().finally(() => prisma.$disconnect());
