import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    // Yalnizca src altindaki birim/servis testleri. e2e/ klasoru Playwright'a
    // ait; Vitest varsayilan olarak *.spec.ts dosyalarini da toplardi ve
    // Playwright testlerini calistirmaya calisirdi.
    include: ["src/**/*.test.ts"],
  },
});
