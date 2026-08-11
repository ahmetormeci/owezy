import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

if (!process.env.E2E_DATABASE_URL) {
  throw new Error(
    "E2E_DATABASE_URL tanimli degil. E2E testleri ayri bir Neon branch'ine yazmalidir; " +
      ".env.local dosyasina E2E_DATABASE_URL ekleyin.",
  );
}

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Testler ayni veritabanini paylastigi icin sirayla calisiyorlar; paralel
  // calissalardi bir testin olusturdugu veri digerinin sayfasinda gorunup
  // beklentileri bozabilirdi.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  timeout: 60_000,

  use: {
    baseURL,
    trace: "retain-on-failure",
  },

  projects: [
    { name: "setup", testMatch: /global\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: baseURL,
    timeout: 120_000,
    // Hazir bir sunucuyu YENIDEN KULLANMIYORUZ: o sunucu yanlis veritabanina
    // bagli olabilir ve testler gercek gelistirme verisinin ustune yazardi.
    reuseExistingServer: false,
    env: {
      // Dev sunucusunu E2E branch'ine baglıyoruz. Next.js, process.env'de zaten
      // var olan degiskenleri .env.local ile EZMEZ; bu yuzden burada verilen
      // deger gecerli olur.
      DATABASE_URL: process.env.E2E_DATABASE_URL,
    },
  },
});
