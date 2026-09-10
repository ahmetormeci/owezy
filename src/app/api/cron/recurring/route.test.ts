import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * BU DOSYA NEYI KORUYOR: bu ucun ACIK KAPI OLMAMASINI.
 *
 * Burasi FINANSAL KAYIT URETIYOR ve bir oturum tasimiyor - tek kapi bir
 * ortam degiskeni. Uc sessiz kusur mumkun:
 *
 *   1. CRON_SECRET yokken CALISMAK. "Yapilandirilmamissa serbest birak"
 *      demek, adresi bilen herkesin harcama urettirebilmesi demek.
 *   2. YANLIS sirri kabul etmek.
 *   3. Sir DOGRUYKEN reddetmek - yani ozelligin canlida hic calismamasi.
 */

const { mockRun } = vi.hoisted(() => ({ mockRun: vi.fn() }));
vi.mock("@/lib/recurring", () => ({ runDueRecurringExpenses: mockRun }));

const { GET } = await import("./route");

function call(authorization?: string) {
  return GET(
    new NextRequest("http://localhost/api/cron/recurring", {
      method: "GET",
      headers: authorization ? { authorization } : {},
    }),
  );
}

const ORIGINAL = process.env.CRON_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  mockRun.mockResolvedValue({ templates: 2, created: 2, paused: 0 });
  process.env.CRON_SECRET = "s3cret-value";
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL;
});

describe("yetki", () => {
  it("CRON_SECRET TANIMLI DEGILSE 503 doner ve HICBIR SEY uretmez", async () => {
    // NEGATIF KONTROL: bu dal duserse adres kimliksiz cagrilabilir hale
    // gelir ve harcama uretir.
    delete process.env.CRON_SECRET;

    const response = await call("Bearer anything");
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.code).toBe("cron.not_configured");
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("baslik YOKSA 401", async () => {
    const response = await call();
    expect(response.status).toBe(401);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("YANLIS sir 401", async () => {
    const response = await call("Bearer wrong-value!");
    expect(response.status).toBe(401);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("dogru sir ama YANLIS SEMA 401 - ciplak deger kabul edilmiyor", async () => {
    const response = await call("s3cret-value");
    expect(response.status).toBe(401);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("UZUNLUGU FARKLI bir sir cokmeye yol acmiyor", async () => {
    // timingSafeEqual uzunluklar farkliysa FIRLATIYOR; onundeki uzunluk
    // kontrolu olmasaydi bu istek 500 verirdi.
    const response = await call("Bearer kisa");
    expect(response.status).toBe(401);
  });

  it("DOGRU sirla calisiyor ve raporu donuyor", async () => {
    const response = await call("Bearer s3cret-value");
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true, templates: 2, created: 2, paused: 0 });
    expect(mockRun).toHaveBeenCalledTimes(1);
  });
});
