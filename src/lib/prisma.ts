import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);

const prismaClient =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: ['warn', 'error'],
        adapter,
    });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prismaClient;
}

export const prisma = prismaClient;
export default prismaClient;
