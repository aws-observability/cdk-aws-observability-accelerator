import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
        rules: {
            indent: ['error', 4],
            "prefer-const": "off",
            "semi": ['error', "always"],
            "no-unused-vars": [1, {"argsIgnorePattern": "^_"}],
        },
    },
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'coverage/**',
            'cdk.out/**',
            '.eslintrc.js',
            'jest.config.js',
        ],
    },
];
