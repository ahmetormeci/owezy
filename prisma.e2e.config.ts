import { defineConfig } from "prisma/config";
import { config as loadEnv } from "dotenv";
import { migrationUrl } from "./prisma-url";

// E2E testleri ayri bir Neon branch'ine yazar; o branch'in de ayni tablolara
// sahip olmasi gerekiyor. Bu dosya SADECE o branch'e migration uygulamak icin
// var: "prisma migrate deploy --config prisma.e2e.config.ts".
//
// Neden ayri bir dosya? Ayni isi "DATABASE_URL'i gecici olarak degistir" diye de
// yapabilirdik; ama o degisken terminalde asili kalirsa sonraki her prisma
// komutu farkinda olmadan E2E branch'ine gider. Ayri dosya, hangi veritabanina
// yazdigimizi komutun kendisinde gorunur kiliyor.
loadEnv({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: migrationUrl("E2E_DATABASE_URL"),
  },
});
