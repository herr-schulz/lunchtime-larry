import { defineConfig } from "vitest/config";

/** Needs the RTDB emulator: `npm run test:rules`. */
export default defineConfig({
  test: {
    include: ["tests/rules/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
