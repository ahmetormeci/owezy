import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * BU DOSYA NEYI KORUYOR: push'un GONDERILMEMESI gereken durumlari ve
 * icine ne konuldugunu.
 *
 * En onemli test "geri alinan transaction" olani. Push GERI ALINAMAZ: bir
 * kez gittikten sonra "aslinda o harcama kaydedilmedi" demenin yolu yok.
 * Bildirim satirlari harcamayla ayni transaction'da yaziliyor ama push
 * cevaptan SONRA gonderiliyor (after) ve after ROTA HATA ATSA DA calisiyor -
 * yani bu dal gercekten yasanabilir bir dal, teorik degil.
 */

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    notification: { findMany: vi.fn() },
    pushToken: { findMany: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
  },
}));

// Gercek modul Neon baglantisi kurmaya calisir (DATABASE_URL okur).
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// after() istek baglami istiyor; testte baglam yok. Cagriyi yakalayip
// ELIMIZDE tutuyoruz ki "planlandi mi" sorusunu da sorabilelim.
const scheduled: (() => unknown)[] = [];
vi.mock("next/server", () => ({
  after: (callback: () => unknown) => {
    scheduled.push(callback);
  },
}));

const { buildPushMessages, deliverPush, registerPushToken } = await import("@/lib/push");

const PUSH = {
  notificationIds: ["n1", "n2"],
  type: "EXPENSE_ADDED" as const,
  groupId: "g1",
  groupName: "Ev",
};

beforeEach(() => {
  vi.restoreAllMocks();
  scheduled.length = 0;
  mockPrisma.notification.findMany.mockReset();
  mockPrisma.pushToken.findMany.mockReset();
  mockPrisma.pushToken.deleteMany.mockReset().mockResolvedValue({ count: 0 });
  mockPrisma.pushToken.upsert.mockReset().mockResolvedValue({});
});

describe("mesajin icerigi", () => {
  it("BASLIK grup adi, GOVDE olayin turu - tutar ve kisi adi YOK", () => {
    const [message] = buildPushMessages([{ token: "ExponentPushToken[a]", locale: "tr" }], PUSH);

    expect(message.title).toBe("Ev");
    expect(message.body).toBe("Yeni bir harcama eklendi");
    // ASIL IDDIA: uygulama icindeki cumle "{actor} yeni bir harcama ekledi"
    // ve tutari da tasiyor. Push'ta ikisi de olmamali - kilit ekraninda
    // yanindaki herkes goruyor ve metin Expo'nun sunucularindan geciyor.
    expect(JSON.stringify(message)).not.toMatch(/\d+[,.]\d{2}|TL|₺/);
  });

  it("DIL ALICININ: ayni olay iki kullaniciya iki dilde gidiyor", () => {
    const messages = buildPushMessages(
      [
        { token: "ExponentPushToken[tr]", locale: "tr" },
        { token: "ExponentPushToken[en]", locale: "en" },
      ],
      PUSH,
    );

    expect(messages[0].body).toBe("Yeni bir harcama eklendi");
    expect(messages[1].body).toBe("A new expense was added");
  });

  it("dili olmayan kullanici varsayilana dusuyor, patlamiyor", () => {
    const [message] = buildPushMessages([{ token: "ExponentPushToken[a]", locale: null }], PUSH);
    expect(message.body).toBe("Yeni bir harcama eklendi");
  });

  it("govdede METIN degil, yalnizca gidilecek grubun kimligi tasiniyor", () => {
    const [message] = buildPushMessages([{ token: "ExponentPushToken[a]", locale: "tr" }], PUSH);
    expect(message.data).toEqual({ groupId: "g1" });
  });
});

describe("gonderilmemesi gereken durumlar", () => {
  it("TRANSACTION GERI ALINDIYSA hicbir sey gonderilmiyor", async () => {
    // Satirlar yok: harcama kaydedilmemis. Bu dalin varlik sebebi, after()
    // rota hata atsa da calisiyor olmasi.
    mockPrisma.notification.findMany.mockResolvedValue([]);
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await deliverPush(PUSH);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockPrisma.pushToken.findMany).not.toHaveBeenCalled();
  });

  it("kimsenin kayitli cihazi yoksa istek atilmiyor", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([{ userId: "u1" }]);
    mockPrisma.pushToken.findMany.mockResolvedValue([]);
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await deliverPush(PUSH);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ALICILAR HAYATTA KALAN SATIRLARDAN okunuyor, listeden degil", async () => {
    // Iki bildirim planlandi ama yalnizca biri yazildi. Cihaz sorgusu
    // yalnizca YAZILAN kullaniciyi sormali.
    mockPrisma.notification.findMany.mockResolvedValue([{ userId: "u2" }]);
    mockPrisma.pushToken.findMany.mockResolvedValue([]);

    await deliverPush(PUSH);

    expect(mockPrisma.pushToken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: { in: ["u2"] } } }),
    );
  });

  it("ag hatasi harcamayi etkilemiyor - firlatmiyor", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([{ userId: "u1" }]);
    mockPrisma.pushToken.findMany.mockResolvedValue([
      { token: "ExponentPushToken[a]", user: { locale: "tr" } },
    ]);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("network"));

    // Firlatsaydi after() icinde yakalanmayan bir hata olurdu.
    await expect(deliverPush(PUSH)).resolves.toBeUndefined();
  });
});

describe("olu adreslerin temizligi", () => {
  it("DeviceNotRegistered donen adres SILINIYOR", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]);
    mockPrisma.pushToken.findMany.mockResolvedValue([
      { token: "ExponentPushToken[canli]", user: { locale: "tr" } },
      { token: "ExponentPushToken[olu]", user: { locale: "tr" } },
    ]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ status: "ok" }, { status: "error", details: { error: "DeviceNotRegistered" } }],
        }),
        { status: 200 },
      ),
    );

    await deliverPush(PUSH);

    // SIRA ONEMLI: Expo'nun cevabi gonderilen dizinin sirasiyla geliyor,
    // baska turlu hangi adresin oldugunu bilmenin yolu yok.
    expect(mockPrisma.pushToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ["ExponentPushToken[olu]"] } },
    });
  });

  it("hepsi basariliysa silme yapilmiyor", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([{ userId: "u1" }]);
    mockPrisma.pushToken.findMany.mockResolvedValue([
      { token: "ExponentPushToken[a]", user: { locale: "tr" } },
    ]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [{ status: "ok" }] }), { status: 200 }),
    );

    await deliverPush(PUSH);

    expect(mockPrisma.pushToken.deleteMany).not.toHaveBeenCalled();
  });
});

describe("cihaz kaydi", () => {
  it("AYNI ADRES BASKA HESABA gecerse satir DEVREDILIYOR, kopyalanmiyor", async () => {
    // Ayni telefondan ikinci bir hesaba giris yapildiginda Expo AYNI adresi
    // veriyor. Yeni satir acilsaydi onceki kullanicinin bildirimleri yeni
    // kullaniciya giderdi.
    await registerPushToken("u2", "ExponentPushToken[a]", "ios");

    expect(mockPrisma.pushToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: "ExponentPushToken[a]" },
        update: expect.objectContaining({ userId: "u2" }),
      }),
    );
  });
});
