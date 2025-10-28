/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.(spec|test).[tj]s?(x)', '**/?(*.)+(spec|test).[tj]s?(x)'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(expo|expo-symbols|expo-modules-core|expo-modules-autolinking|@expo|@react-native|react-native|react-native-reanimated|react-native-gesture-handler|react-native-css-interop|nativewind|react-native-worklets|@rn-primitives/slot)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/.bun/'],
  modulePathIgnorePatterns: ['/.bun/'],
  watchPathIgnorePatterns: ['/.bun/'],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'src/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 70,
      functions: 70,
      lines: 70,
    },
  },
};
