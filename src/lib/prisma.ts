import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL is required');
    }

    return new PrismaClient({
        log: ['warn', 'error'],
        adapter: new PrismaPg({ connectionString: databaseUrl }),
    });
}

function getPrismaClient() {
    if (process.env.NODE_ENV === 'production') {
        return createPrismaClient();
    }

    if (!globalForPrisma.prisma) {
        globalForPrisma.prisma = createPrismaClient();
    }

    return globalForPrisma.prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
    get(_target, prop) {
        const client = getPrismaClient() as unknown as Record<string | symbol, unknown>;
        const value = client[prop];
        if (typeof value === 'function') {
            return (value as (...args: unknown[]) => unknown).bind(client);
        }
        return value;
    },
});

export default prisma;
