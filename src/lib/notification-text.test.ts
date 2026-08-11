import { describe, expect, it } from "vitest";
import { describeNotification, formatRelativeTime } from "@/lib/notification-text";

const FULL_PAYLOAD = {
  groupId: "11111111-1111-4111-8111-111111111111",
  groupName: "Ev",
  actorName: "Ali",
  description: "Market",
  amount: 12050,
  currency: "TRY",
};

describe("describeNotification", () => {
  it("harcama eklendi bildirimini yazar", () => {
    const view = describeNotification("EXPENSE_ADDED", FULL_PAYLOAD);

    expect(view.title).toBe("Ali yeni bir harcama ekledi");
    // Tutar kurus cinsinden saklanip ekranda bicimleniyor.
    expect(view.detail).toBe("Market · 120,50 ₺");
    expect(view.groupName).toBe("Ev");
    expect(view.href).toBe("/groups/11111111-1111-4111-8111-111111111111");
  });

  it("her olay tipi icin ayri bir cumle uretir", () => {
    const titles = (
      [
        "EXPENSE_ADDED",
        "EXPENSE_UPDATED",
        "EXPENSE_DELETED",
        "SETTLEMENT_RECORDED",
        "SETTLEMENT_CANCELLED",
        "MEMBER_JOINED",
      ] as const
    ).map((type) => describeNotification(type, FULL_PAYLOAD).title);

    expect(new Set(titles).size).toBe(6);
    expect(titles.every((title) => title.startsWith("Ali "))).toBe(true);
  });

  it("odeme bildiriminde aciklama yoksa yalnizca tutari gosterir", () => {
    const view = describeNotification("SETTLEMENT_RECORDED", {
      groupId: "g1",
      groupName: "Ev",
      actorName: "Ali",
      amount: 5000,
      currency: "TRY",
    });

    expect(view.detail).toBe("50,00 ₺");
  });

  it("gruba katilma bildiriminde ayrinti satiri olmaz", () => {
    const view = describeNotification("MEMBER_JOINED", {
      groupId: "g1",
      groupName: "Ev",
      actorName: "Ali",
    });

    expect(view.title).toBe("Ali gruba katıldı");
    expect(view.detail).toBeNull();
  });

  // Payload veritabaninda Json kolonunda duruyor: tip guvencesi yok. Eksik ya da
  // bozuk bir kayit gelirse cokmek yerine elimizdekiyle cumle kurmali.
  it("payload bos ise bile anlamli bir cumle uretir", () => {
    const view = describeNotification("EXPENSE_ADDED", {});

    expect(view.title).toBe("Birisi yeni bir harcama ekledi");
    expect(view.detail).toBeNull();
    expect(view.groupName).toBeNull();
    expect(view.href).toBeNull();
  });

  it("payload hic yoksa ya da beklenmedik turdeyse cokmez", () => {
    for (const payload of [null, undefined, "metin", 42, []]) {
      const view = describeNotification("EXPENSE_DELETED", payload);
      expect(view.title).toBe("Birisi bir harcamayı sildi");
    }
  });

  it("tutar varken para birimi yoksa tutari gostermez", () => {
    const view = describeNotification("EXPENSE_ADDED", {
      actorName: "Ali",
      description: "Market",
      amount: 12050,
    });

    expect(view.detail).toBe("Market");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-08-11T12:00:00Z");

  it("bir dakikadan yeni kayitlar icin 'az önce' der", () => {
    expect(formatRelativeTime(new Date("2026-08-11T11:59:30Z"), now)).toBe("az önce");
  });

  it("dakika, saat ve gun esiklerini kullanir", () => {
    expect(formatRelativeTime(new Date("2026-08-11T11:57:00Z"), now)).toBe(
      "3 dakika önce",
    );
    expect(formatRelativeTime(new Date("2026-08-11T09:00:00Z"), now)).toBe(
      "3 saat önce",
    );
    expect(formatRelativeTime(new Date("2026-08-09T12:00:00Z"), now)).toBe("2 gün önce");
  });

  it("bir haftadan eski kayitlarda tam tarih gosterir", () => {
    expect(formatRelativeTime(new Date("2026-07-01T12:00:00Z"), now)).toMatch(/2026/);
  });

  // Sunucu ve tarayici saatleri birkac saniye kayabilir; gelecek tarihli bir
  // kayit "-1 dakika önce" gibi sacma bir metin uretmemeli.
  it("gelecekte gorunen kayitlar icin 'az önce' der", () => {
    expect(formatRelativeTime(new Date("2026-08-11T12:05:00Z"), now)).toBe("az önce");
  });
});
