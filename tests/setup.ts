// Jest setup file
jest.mock('isomorphic-dompurify', () => {
  return {
    sanitize: (val: string) => val,
    default: {
      sanitize: (val: string) => val,
    }
  };
});

// Mock global prisma to avoid database connection errors during module loading
jest.mock('@/lib/prisma', () => {
  return {
    prisma: {
      adminCredential: {
        count: jest.fn(async () => 1),
        findUnique: jest.fn(async () => null),
        update: jest.fn(async () => ({})),
      },
      auditLog: {
        create: jest.fn(async () => ({})),
      },
      menuItem: {
        create: jest.fn(async () => ({})),
        findUnique: jest.fn(async () => null),
      },
    },
  };
});
