import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * YAZMA UCLARININ TAMAMI HIZ SINIRINDAN GECIYOR MU?
 *
 * NEDEN BOYLE BIR TEST: sinir 15 ayri dosyanin basina elle konuldu. Yarin
 * yeni bir yazma ucu eklendiginde iki satiri unutmak kolay - ve unutuldugunu
 * hicbir sey soylemez. Testler gecer, uc calisir, yalnizca korumasiz olur.
 * Sessizce kaybolan bir koruma, hic olmayandan kotudur cunku var sanilir.
 *
 * KAYNAK METNINE BAKIYOR ve bu bilincli. Davranisi sinamak icin her ucu tek
 * tek cagirmak gerekirdi; oysa burada korunan sey bir davranis degil, bir
 * KURAL: "yazan her uc butceden geciyor".
 *
 * Ayni gerekce e2e/auth.spec.ts'teki Bearer sozlesmesi testinde de var: biri
 * ileride cerez varsayan bir kontrol eklerse mobil sessizce kirilirdi.
 *
 * OKUMA UCLARI KAPSAM DISI ve olmasi gereken de bu (bkz. lib/api-rate-limit.ts):
 * grup sayfasi tek seferde bes paralel GET atiyor; her birine bir veritabani
 * turu eklemek sicak yolu bir istemci hatasi icin yavaslatirdi.
 */
const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"];
const API_ROOT = join(process.cwd(), "src/app/api/v1");

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return entry.name === "route.ts" ? [full] : [];
  });
}

/** Dosyayi "export async function X" sinirlarindan parcalara ayirir. */
function handlers(source: string): { method: string; body: string }[] {
  const parts = source.split(/(export async function [A-Z]+)/);
  const found: { method: string; body: string }[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    found.push({ method: parts[i].split(" ").pop()!, body: parts[i + 1] });
  }
  return found;
}

describe("/api/v1 yazma uclari", () => {
  const files = routeFiles(API_ROOT);

  it("route dosyalarini bulabiliyor", () => {
    // Kendi kendini koruyan bir kontrol: yol degisir de dosya bulunamazsa,
    // asagidaki test hicbir sey sinamadan GECERDI.
    expect(files.length).toBeGreaterThan(15);
  });

  it("hepsi enforceWriteLimit cagiriyor", () => {
    const missing: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const handler of handlers(source)) {
        if (!WRITE_METHODS.includes(handler.method)) continue;
        if (!handler.body.includes("enforceWriteLimit(")) {
          missing.push(`${file.replace(API_ROOT, "")} -> ${handler.method}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("okuma uclarina EKLENMEMIS", () => {
    const wrongly: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const handler of handlers(source)) {
        if (handler.method !== "GET") continue;
        if (handler.body.includes("enforceWriteLimit(")) {
          wrongly.push(file.replace(API_ROOT, ""));
        }
      }
    }

    expect(wrongly).toEqual([]);
  });
});
