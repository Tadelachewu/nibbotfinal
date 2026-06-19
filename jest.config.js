process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/mock';

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFiles: ['<rootDir>/tests/setup.ts'],
  testMatch: ['**/tests/unit/**/*.test.ts'],
};
