import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import astroPlugin from 'eslint-plugin-astro';

export default [
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            '@typescript-eslint/explicit-function-return-type': 'warn',
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
        },
    },
    ...astroPlugin.configs.recommended,
    {
        ignores: ['node_modules/**', 'dist/**', '.astro/**', 'bun.lockb'],
    },
];
