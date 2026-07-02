module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: 'vue-eslint-parser',
  parserOptions: {
    ecmaVersion: 'latest',
    parser: '@typescript-eslint/parser',
    sourceType: 'module',
  },
  plugins: ['vue', '@typescript-eslint'],
  rules: {
    'vue/multi-word-component-names': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      files: ['src/views/**/*.vue'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector:
              "VAttribute[directive=false][key.name='class'][value.value=/\\bpb-(20|24|28)\\b/]",
            message:
              'acme/no-bottom-nav-magic-padding: AppShell owns bottom navigation inset; do not hard-code pb-20, pb-24, or pb-28 in views.',
          },
        ],
      },
    },
  ],
  ignorePatterns: ['dist', 'dev-dist', 'node_modules', '*.config.js', '*.config.ts'],
}
