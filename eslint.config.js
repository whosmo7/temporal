import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'supabase/functions'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  {
    // Engine and worldgen must stay pure and deterministic.
    files: ['src/engine/**/*.ts', 'src/worldgen/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded PRNG.' },
        { object: 'Date', property: 'now', message: 'Pass time in as an argument.' },
      ],
      'no-restricted-imports': [
        'error',
        { patterns: ['react', 'react-*', 'pixi.js', 'zustand', '@supabase/*'] },
      ],
    },
  },
);
