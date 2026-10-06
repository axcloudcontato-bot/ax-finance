/**
 * Lint do monorepo. Duas camadas:
 * - todo o TypeScript: recomendado do ESLint + @typescript-eslint;
 * - apps/web: regras do Next (core-web-vitals) e dos hooks do React por cima.
 *
 * Regras que denunciam bug real ficam como erro (quebram o CI). As que só apontam estilo ou dívida
 * antiga ficam como aviso, para o lint ser um sinal e não um ruído que todo mundo aprende a ignorar.
 */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  env: { node: true, es2022: true },
  ignorePatterns: [
    "node_modules/",
    ".next/",
    "dist/",
    "coverage/",
    "**/*.d.ts",
    "apps/web/public/",
    "packages/db/prisma/migrations/",
  ],
  rules: {
    // Variável não usada é quase sempre resto de refatoração; prefixo _ marca o intencional.
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-non-null-assertion": "off",
    "no-console": "off",
  },
  overrides: [
    {
      files: ["apps/web/**/*.{ts,tsx}"],
      extends: ["next/core-web-vitals"],
      env: { browser: true },
      settings: { next: { rootDir: "apps/web" } },
      rules: {
        // Textos em português levam aspas e apóstrofos; escapar tudo só piora a leitura do JSX.
        "react/no-unescaped-entities": "off",
        // A prévia do site usa <img> de arquivos estáticos próprios; o otimizador do Next não agrega ali.
        "@next/next/no-img-element": "warn",
      },
    },
    {
      files: ["**/*.test.ts", "**/__tests__/**"],
      rules: { "@typescript-eslint/no-explicit-any": "off" },
    },
  ],
};
