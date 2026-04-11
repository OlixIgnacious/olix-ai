module.exports = {
  preset: '@react-native/jest-preset',

  // Map @/ path alias to src/ (merges with preset's react-native mapping)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native$': require.resolve('react-native'),
  },

  // Extend the RN preset's default to also transform React Navigation packages
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      '(jest-)?react-native' +
      '|@react-native(-community)?' +
      '|@react-navigation' +
      '|react-native-screens' +
      '|react-native-safe-area-context' +
      ')/)',
  ],
};
