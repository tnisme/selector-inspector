
const globals = require("globals");
const js = require("@eslint/js");

module.exports = [
    {
        ignores: ["dist/**", "node_modules/**"]
    },
    js.configs.recommended,
    {
        ignores: ["dist/**"],
        files: ["**/*.js"],
        languageOptions: {
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.node,
                chrome: "readonly",
                // Global functions from other files
                clearOverlays: "readonly",
                findByCss: "readonly",
                findByXPath: "readonly",
                findByPlaywright: "readonly",
                findBySmartLocator: "readonly",
                renderOverlays: "readonly",
                buildInspectResult: "readonly",
                inspectLocator: "readonly"
            }
        },
        rules: {
            "no-unused-vars": ["warn", {
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_",
                "caughtErrorsIgnorePattern": "^_"
            }],
            "no-undef": "warn",
            "no-useless-escape": "off",
            "no-empty": ["error", { "allowEmptyCatch": true }]
        }
    }
];
