import js from '@eslint/js';
import globals from 'globals';

export default [
    { ignores: ["dist/"] },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.node,
                CODE_LENGTH: "readonly",
                CODE_HASH: "readonly",
                SALT: "readonly",
                IV: "readonly",
                ENCRYPTED_MESSAGE: "readonly"
            }
        },
        rules: {
            "no-unused-vars": "warn",
            "no-console": "off"
        }
    }
];
