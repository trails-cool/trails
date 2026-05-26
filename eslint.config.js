import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importX from "eslint-plugin-import-x";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["**/build/", "**/dist/", "**/.react-router/", "**/.expo/", "**/node_modules/", "**/metro.config.js"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  // Require explicit file extensions on relative imports — but ONLY
  // for files Node executes as raw .ts (server entrypoint, .server.ts
  // modules, jobs, shared packages). Our tsconfig uses
  // `moduleResolution: bundler` so TypeScript accepts extensionless
  // imports everywhere; but `apps/*/server.ts` and the .server.ts /
  // jobs files it loads run through Node's strict NodeNext resolver
  // at runtime, which requires extensions. Without this rule the two
  // resolvers diverge silently — that gap let `email.server.ts` ship
  // a broken `./logger.server` import that crashed at boot.
  //
  // Client-side files (routes, hooks, components) are bundled by
  // Vite and don't need explicit extensions.
  {
    files: [
      "apps/*/server.ts",
      "apps/*/app/lib/**/*.server.ts",
      "apps/*/app/jobs/**/*.ts",
      "packages/*/src/**/*.ts",
      "packages/*/src/**/*.tsx",
    ],
    ignores: [
      // Route-scoped .server.ts files live under app/routes and are
      // bundled by Vite into the React Router build — Node never
      // loads them directly. Tests run under Vitest's own resolver
      // and aren't shipped to Docker.
      "apps/*/app/routes/**/*.server.ts",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
    plugins: { "import-x": importX },
    rules: {
      "import-x/extensions": [
        "error",
        "always",
        { ignorePackages: true, checkTypeImports: true },
      ],
    },
  },
  prettier,
);
