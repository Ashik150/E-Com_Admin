import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["test/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      include: [
        "src/modules/auth/authentication.service.ts",
        "src/middleware/authenticate.ts",
        "src/middleware/require-permissions.ts",
      ],
    },
  },
});
