module.exports = {
  root: true,
  extends: [
    '@react-native',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'prettier'],
  rules: {
    'prettier/prettier': 'error',

    // No any types — enforced hard
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',

    // Consistent style
    '@typescript-eslint/explicit-function-return-type': ['warn', {allowExpressions: true}],
    '@typescript-eslint/consistent-type-imports': ['error', {prefer: 'type-imports'}],

    // React Native specific
    'react-native/no-inline-styles': 'error',
    'react-native/no-raw-text': ['error', {skip: []}],
  },
  ignorePatterns: [
    'node_modules/',
    'android/',
    'ios/',
    'coverage/',
    'babel.config.js',
    'metro.config.js',
    'jest.config.js',
    '.eslintrc.js',
  ],
};
