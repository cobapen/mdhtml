import { defineConfig } from "vite";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: [
        "src/**",
      ],
      reportsDirectory: "./.coverage",
    },
  }
});