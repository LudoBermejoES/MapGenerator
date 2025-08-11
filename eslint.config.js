const js = require('@eslint/js');
const typescript = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        HTMLCanvasElement: 'readonly',
        HTMLElement: 'readonly',
        requestAnimationFrame: 'readonly',
        performance: 'readonly',
        XMLSerializer: 'readonly',
        // Node globals
        require: 'readonly',
        // dat.gui
        dat: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      // Disable overly strict rules for this legacy codebase
      '@typescript-eslint/no-explicit-any': 'warn', // Try to fix where possible
      '@typescript-eslint/no-unused-vars': 'off', // Many interface parameters are unused by design
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off', // TypeScript handles this
      'no-redeclare': 'off',
      'no-useless-escape': 'warn',
    },
  },
  {
    files: ['gulpfile.js', 'eslint.config.js', 'build.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'script',
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
    },
  },
  {
    ignores: ['node_modules/**', 'dist/**', '**/*.d.ts'],
  },
];