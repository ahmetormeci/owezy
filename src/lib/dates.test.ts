import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/dates";

// Tarihler YEREL saatle kuruluyor: new Date("2026-08-12") UTC gece yarisi
// demek ve UTC'nin batisindaki bir makinede bir onceki gune duserdi. Testin
// makinenin saat diliminden bagimsiz olmasi gerekiyor.
const AUGUST_12 = new Date(2026, 7, 12);
const AUGUST_5 = new Date(2026, 7, 5);

describe("formatDate", () => {
  it("Turkcede gun once, ay kisaltmasi Turkce", () => {
    expect(formatDate(AUGUST_12, "tr")).toBe("12 Ağu 2026");
  });

  it("Ingilizcede ay once ve virgul var", () => {
    expect(formatDate(AUGUST_12, "en")).toBe("Aug 12, 2026");
  });

  it("gun her zaman iki basamak", () => {
    // Listelerde tarihler alt alta diziliyor; "5 Agu" ile "12 Agu" farkli
    // genislikte olsaydi sutun kayardi (ADR-016).
    expect(formatDate(AUGUST_5, "tr")).toBe("05 Ağu 2026");
    expect(formatDate(AUGUST_5, "en")).toBe("Aug 05, 2026");
  });

  it("dil verilmezse Turkce", () => {
    expect(formatDate(AUGUST_12)).toBe(formatDate(AUGUST_12, "tr"));
  });
});
