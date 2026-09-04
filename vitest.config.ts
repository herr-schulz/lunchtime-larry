import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scrape/**/*.test.ts"],
  },
});
