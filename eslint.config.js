import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "node_modules",
      "android/**",
      "ios/**",
      "bot-api/**",
      "portal-aluno-api/**",
      "portal-aluno-frontend/**",
      "super-admin-api/**",
      "super-admin-frontend/**",
      "supabase/.temp/**",
      "**/build/**",
      "src/integrations/supabase/types.ts",
      "public/._*",
      "**/._*",
      "vite.config.ts.timestamp-*.mjs",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // ARCHITECTURE RULE: Block direct Supabase imports in Pages
  {
    files: ["src/pages/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/integrations/supabase/client",
              message: "❌ Pages cannot import Supabase directly. Use domain services instead (e.g., @/domains)."
            }
          ],
          patterns: [
            {
              group: ["**/integrations/supabase/**"],
              message: "❌ Architecture violation: Use services from @/domains instead of direct Supabase access."
            }
          ]
        }
      ]
    }
  },
  // ANTI-REGRESSION: Block import of removed legacy offline functions
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/offlineChamada",
              importNames: ["salvarChamadaOffline", "getChamadasPendentes", "sincronizarChamadasOffline"],
              message: "❌ REMOVIDO: Use presencaService.salvarChamada() e triggerSync() de @/lib/SyncManager"
            }
          ]
        }
      ]
    }
  }
);
