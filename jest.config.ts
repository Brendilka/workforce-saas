import type { Config } from 'jest';

const config: Config = {
  displayName: 'BDK Workforce SaaS',
  testEnvironment: 'node',
  preset: 'ts-jest',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts*',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  testTimeout: 10000,
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
};

export default config;
