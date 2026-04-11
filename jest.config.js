module.exports = {
  preset: '@react-native/jest-preset',

  // Map @/ path alias to src/ (merges with preset's react-native mapping)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native$': require.resolve('react-native'),
  },

  // Extend the RN preset's default to also transform React Navigation packages
  // and uuid (pure-ESM package that needs Babel transpilation in Jest).
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      '(jest-)?react-native' +
      '|@react-native(-community)?' +
      '|@react-navigation' +
      '|react-native-screens' +
      '|react-native-safe-area-context' +
      '|rn-fetch-blob' +
      '|uuid' +
      ')/)',
  ],

  // helpers.ts inside __tests__/ is a shared utility, not a test suite.
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/db/helpers\\.ts$'],
};
