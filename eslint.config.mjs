import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

const tsParserOptions = {
  projectService: true,
  tsconfigRootDir: import.meta.dirname,
}

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'dist-renderer/**',
      'dist-electron/**',
      'release/**',
      'node_modules/**',
      '*.config.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['src/**/*.{ts,tsx}', 'electron/**/*.ts', 'vite.config.ts', 'vite.config.renderer.ts'],
    languageOptions: {
      parserOptions: tsParserOptions,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
)
