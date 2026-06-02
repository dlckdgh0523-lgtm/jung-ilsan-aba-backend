/**
 * Two projects so `jest --coverage` MERGES unit + e2e coverage:
 *   npm test       → unit only (fast, no DB)
 *   npm run test:e2e → e2e only (needs the test DB)
 *   npm run test:cov → both, with merged coverage + thresholds (CI gate)
 */
const tsTransform = { '^.+\\.(t|j)s$': 'ts-jest' };
const base = { testEnvironment: 'node', moduleFileExtensions: ['js', 'json', 'ts'], transform: tsTransform };

module.exports = {
  collectCoverageFrom: [
    'src/**/*.service.ts',
    'src/**/*.controller.ts',
    'src/common/**/*.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.interface.ts',
    '!src/main.ts',
  ],
  coverageDirectory: 'coverage',
  // Gate at levels the suite meets today (statements/lines 70%+). Branch/function
  // coverage is lower because many guards/branches aren't exercised yet — raise as
  // more per-module tests land (target: services 80% / controllers 70% / overall 75%).
  coverageThreshold: {
    global: { statements: 70, branches: 40, functions: 55, lines: 70 },
  },
  projects: [
    { ...base, displayName: 'unit', rootDir: '<rootDir>', testMatch: ['<rootDir>/src/**/*.spec.ts'] },
    {
      ...base,
      displayName: 'e2e',
      rootDir: '<rootDir>',
      testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
      setupFiles: ['<rootDir>/test/setup-e2e.ts'],
    },
  ],
};
