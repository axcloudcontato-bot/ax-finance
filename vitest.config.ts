import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    fileParallelism: false, // testes de integração compartilham um único banco de teste
    testTimeout: 15000,
  },
});
