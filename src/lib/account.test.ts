import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/lib/errors";

/**
 * BU DOSYA NEYI KORUYOR: hesap silmenin, SILMEMESI GEREKEN seye
 * dokunmamasini.
 *
 * Silme App Store Guideline 5.1.1(v) yuzunden zorunlu, ama bu uygulamada
 * "sil" komutunun karsisinda degistirilemez bir kural duruyor: FINANSAL
 * KAYITLAR FIZIKSEL OLARAK SILINMEZ. Bir kullanicinin harcamalari ve
 * odemeleri yalnizca onun kaydi degil - grupta kalanlarin bakiyeleri de o
 * satirlardan hesaplaniyor. Silinselerdi baskalarinin parasi yanlis
 * gorunurdu.
 *
 * Yani buradaki testlerin yarisi "sunu yapti mi", yarisi "suna DOKUNMADI mi"
 * diye soruyor. Ikincisi daha onemli.
 */

const { mockTx } = vi.hoisted(() => ({
  mockTx: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    groupMember: { findMany: vi.fn(), update: vi.fn() },
    group: { update: vi.fn() },
    session: { deleteMany: vi.fn() },
    account: { deleteMany: vi.fn() },
    twoFactor: { deleteMany: vi.fn() },
    notification: { deleteMany: vi.fn() },
    // Bu ikisi BILEREK var ve BILEREK hic cagrilmamali: testler
    // "dokunulmadi" iddiasini ancak taklit mevcutsa dogrulayabilir.
    expense: { deleteMany: vi.fn(), updateMany: vi.fn() },
    settlement: { deleteMany: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (callback: (tx: typeof mockTx) => unknown) => callback(mockTx),
  },
}));

const { deleteAccount } = await import("@/lib/account");

const USER = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mockTx.user.findUnique.mockResolvedValue({ id: USER, deletedAt: null });
  mockTx.groupMember.findMany.mockResolvedValue([]);
  mockTx.user.update.mockResolvedValue({});
});

/** Kullanicinin aktif uyeligi + o gruptaki DIGER aktif uyeler. */
function withGroup(
  membership: { id: string; groupId: string; role: "OWNER" | "MEMBER" },
  others: { id: string }[],
) {
  mockTx.groupMember.findMany
    .mockResolvedValueOnce([membership]) // kullanicinin uyelikleri
    .mockResolvedValueOnce(others); // o gruptaki digerleri
}

describe("kisisel veri", () => {
  it("adresi ANONIMLESTIRIYOR ve gercek adresi serbest birakiyor", async () => {
    await deleteAccount(USER);

    const data = mockTx.user.update.mock.calls[0][0].data;
    // .invalid RFC 2606'da ayrilmis: bu adrese kazara posta gitmesi mumkun
    // degil. Gercek adres serbest kaliyor, kisi yeniden uye olabilir.
    expect(data.email).toBe(`deleted+${USER}@deleted.invalid`);
    expect(data.email).not.toContain("@owezy");
  });

  it("adi, gorselini ve dil tercihini temizliyor", async () => {
    await deleteAccount(USER);

    const data = mockTx.user.update.mock.calls[0][0].data;
    expect(data.displayName).toBe("Silinmiş kullanıcı");
    expect(data.avatarUrl).toBeNull();
    expect(data.hasImage).toBe(false);
    expect(data.locale).toBeNull();
  });

  it("deletedAt isaretliyor - SOFT delete", async () => {
    await deleteAccount(USER);

    expect(mockTx.user.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
  });

  it("dogrulanmis ve 2FA iddialarini dusuruyor", async () => {
    // Adres artik bize ait degil; "dogrulanmis" demeye devam etmek yanlis
    // olurdu.
    await deleteAccount(USER);

    const data = mockTx.user.update.mock.calls[0][0].data;
    expect(data.emailVerified).toBe(false);
    expect(data.twoFactorEnabled).toBe(false);
  });
});

describe("kimlik bilgileri", () => {
  it("oturumlari, hesap baglarini ve 2FA kayitlarini FIZIKSEL siliyor", async () => {
    /**
     * Bunlar finansal kayit DEGIL, kimlik bilgisi. Kalirlarsa silinmis bir
     * hesabin belirteci calismaya, PAROLASI gecerli olmaya devam ederdi -
     * yani "hesabimi sildim" diyen birinin parolasini saklamis olurduk.
     */
    await deleteAccount(USER);

    expect(mockTx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: USER } });
    expect(mockTx.account.deleteMany).toHaveBeenCalledWith({ where: { userId: USER } });
    expect(mockTx.twoFactor.deleteMany).toHaveBeenCalledWith({ where: { userId: USER } });
  });

  it("bildirimleri de siliyor", async () => {
    await deleteAccount(USER);
    expect(mockTx.notification.deleteMany).toHaveBeenCalledWith({ where: { userId: USER } });
  });
});

describe("FINANSAL KAYITLARA DOKUNMUYOR", () => {
  it("harcama ve odeme satirlarini ne siliyor ne degistiriyor", async () => {
    /**
     * DEGISTIRILEMEZ KURALIN TESTI. Bu satirlar yalnizca silinen kisinin
     * kaydi degil: grupta KALANLARIN bakiyeleri de onlardan hesaplaniyor.
     * Silinselerdi baskalarinin parasi yanlis gorunurdu ve bunu kimse fark
     * etmezdi - bakiye yine bir sayi dondururdu, sadece yanlis olurdu.
     */
    withGroup({ id: "m1", groupId: "g1", role: "MEMBER" }, [{ id: "m2" }]);

    await deleteAccount(USER);

    expect(mockTx.expense.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.expense.updateMany).not.toHaveBeenCalled();
    expect(mockTx.settlement.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.settlement.updateMany).not.toHaveBeenCalled();
  });

  it("ACIK BAKIYE silmeyi ENGELLEMIYOR", async () => {
    /**
     * leaveGroup() bakiye kapali degilse ayrilmayi reddediyor ve gruptan
     * cikma icin bu dogru. Ama hesap silmeyi borca baglamak, kullaniciyi
     * kendi verisinin icinde REHIN tutmak olurdu (ADR-031). Servis bakiyeye
     * HIC BAKMIYOR - uyari arayuzun isi.
     */
    withGroup({ id: "m1", groupId: "g1", role: "MEMBER" }, [{ id: "m2" }]);

    await expect(deleteAccount(USER)).resolves.toMatchObject({ leftGroups: 1 });
  });
});

describe("gruplar", () => {
  it("uyeligi kapatiyor", async () => {
    withGroup({ id: "m1", groupId: "g1", role: "MEMBER" }, [{ id: "m2" }]);

    await deleteAccount(USER);

    expect(mockTx.groupMember.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "m1" } }),
    );
  });

  it("SAHIPSE sahipligi EN ESKI aktif uyeye devrediyor", async () => {
    // Her grupta her zaman bir OWNER bulunmali. Devir keyfi degil: sorgu
    // joinedAt'e gore siraliyor, yani gruptaki en uzun sureli kisi.
    withGroup({ id: "m1", groupId: "g1", role: "OWNER" }, [{ id: "eskiUye" }, { id: "yeniUye" }]);

    const result = await deleteAccount(USER);

    expect(mockTx.groupMember.update).toHaveBeenCalledWith({
      where: { id: "eskiUye" },
      data: { role: "OWNER" },
    });
    expect(result.transferredGroups).toBe(1);

    /**
     * SIRALAMANIN KENDISI DE SABITLENIYOR ve bunun sebebi bir MUTASYONUN
     * KACMASI: taklit findMany, orderBy'i yok sayip her zaman ayni diziyi
     * donduruyor. Yani "eskiUye secildi" iddiasi tek basina asc ile desc'i
     * AYIRT EDEMIYOR - sorgu tersine cevrildiginde ustteki iki beklenti de
     * geciyordu. Sonucu belirleyen sey sorgunun kendisi, o yuzden o da
     * kontrol ediliyor.
     */
    expect(mockTx.groupMember.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ orderBy: { joinedAt: "asc" } }),
    );
  });

  it("sahip DEGILSE kimseye sahiplik vermiyor", async () => {
    withGroup({ id: "m1", groupId: "g1", role: "MEMBER" }, [{ id: "m2" }]);

    const result = await deleteAccount(USER);

    expect(result.transferredGroups).toBe(0);
    expect(mockTx.groupMember.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: "OWNER" } }),
    );
  });

  it("gruptaki SON kisiyse grubu arsivliyor", async () => {
    // Gruba artik kimse erisemez. Ortada birakmak yerine isaretliyoruz;
    // kayitlar duruyor (leaveGroup ile ayni davranis).
    withGroup({ id: "m1", groupId: "g1", role: "OWNER" }, []);

    const result = await deleteAccount(USER);

    expect(mockTx.group.update).toHaveBeenCalledWith({
      where: { id: "g1" },
      data: { deletedAt: expect.any(Date) },
    });
    expect(result.archivedGroups).toBe(1);
  });

  it("son kisiyken sahiplik devretmeye CALISMIYOR", async () => {
    // Devredilecek kimse yok; burada bir devir denemesi cokerdi.
    withGroup({ id: "m1", groupId: "g1", role: "OWNER" }, []);

    const result = await deleteAccount(USER);

    expect(result.transferredGroups).toBe(0);
  });
});

describe("sinir durumlar", () => {
  it("zaten silinmis hesabi tekrar silmiyor", async () => {
    mockTx.user.findUnique.mockResolvedValue({ id: USER, deletedAt: new Date() });

    await expect(deleteAccount(USER)).rejects.toBeInstanceOf(NotFoundError);
    expect(mockTx.user.update).not.toHaveBeenCalled();
  });

  it("olmayan kullanici icin NotFound firlatiyor", async () => {
    mockTx.user.findUnique.mockResolvedValue(null);

    await expect(deleteAccount(USER)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("hic grubu olmayan hesap da silinebiliyor", async () => {
    const result = await deleteAccount(USER);

    expect(result).toEqual({ archivedGroups: 0, transferredGroups: 0, leftGroups: 0 });
    expect(mockTx.user.update).toHaveBeenCalled();
  });
});
