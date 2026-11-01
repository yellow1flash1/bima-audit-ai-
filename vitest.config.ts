import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // integration tests hit a live local Supabase; run them with `npm run test:it`
    exclude: ["**/node_modules/**", process.env.IT ? "" : "**/*.it.test.ts"].filter(Boolean),
  },
});
