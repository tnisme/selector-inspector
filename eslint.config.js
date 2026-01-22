import js from "@eslint/js";

export default [
  js.configs.recommended,

  {
    ignores: ["node_modules/", "dist/", "build/", "coverage/", "*.min.js"],
  },

  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        browser: "readonly",
        chrome: "readonly",
        window: "readonly",
        document: "readonly",
        Node: "readonly",
        XPathResult: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        console: "readonly",
      },
    },
    rules: {
      indent: ["error", 2],
      "linebreak-style": ["error", "unix"],
      quotes: ["error", "single", { avoidEscape: true }],
      semi: ["error", "always"],

      "no-unused-vars": [
        "warn",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      "no-console": ["warn", { allow: ["warn", "error", "log"] }],
      "no-useless-escape": "warn",
    },
  },
];
