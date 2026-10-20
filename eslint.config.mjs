import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Design doc, Security: only the access layer may touch the database, so permission checks
  // and private-field filtering cannot be bypassed by a page or action querying tables directly.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/access/**", "src/db/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/db", "@/db/*", "**/db", "**/db/*", "drizzle-orm", "drizzle-orm/*", "postgres"],
              message: "Truy cập DB chỉ qua src/lib/access/ (xem design doc, phần Bảo mật).",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
