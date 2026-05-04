import coreWebVitals from 'eslint-config-next/core-web-vitals';

export default [
  ...coreWebVitals,
  {
    rules: {
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-require-imports': 'error',
    },
  },
  {
    files: ['e2e/**/*.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  {
    ignores: ['.sst/**', '.open-next/**', 'coverage/**']
  }
];
