import { defineConfig } from "prisma/config";
import { config as loadEnv } from "dotenv";
import { migrationUrl } from "./prisma-url";

// Next.js zaten .env.local dosyasini uygulama calisirken otomatik okuyor.
// Prisma CLI (npx prisma ...) ise .env.local'i tanimiyor; bu yuzden ayni dosyayi
// burada elle yukluyoruz. Boylece tek bir env dosyasi (.env.local) kaynak olarak kaliyor.
loadEnv({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: migrationUrl("DATABASE_URL"),
  },
});
