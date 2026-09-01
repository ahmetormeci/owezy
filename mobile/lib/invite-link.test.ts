import { describe, expect, it } from "vitest";
import { inviteTokenFrom } from "./invite-link";

describe("inviteTokenFrom", () => {
  it("tam baglantidan kodu cikariyor", () => {
    expect(inviteTokenFrom("https://owezy.net/join/abc123")).toBe("abc123");
  });

  it("ciplak kodu oldugu gibi kabul ediyor", () => {
    expect(inviteTokenFrom("abc123")).toBe("abc123");
  });

  it("bastaki ve sondaki bosluklari atiyor", () => {
    expect(inviteTokenFrom("  abc123\n")).toBe("abc123");
  });

  it("sorgu dizesini atiyor", () => {
    expect(inviteTokenFrom("https://owezy.net/join/abc123?utm=whatsapp")).toBe("abc123");
  });

  it("sondaki egik cizgiyi atiyor", () => {
    expect(inviteTokenFrom("https://owezy.net/join/abc123/")).toBe("abc123");
  });

  /** Paylasim uygulamalari adresin arkasina metin ekleyebiliyor. */
  it("adresin ardindaki metni atiyor", () => {
    expect(inviteTokenFrom("https://owezy.net/join/abc123 Owezy'ye katil")).toBe("abc123");
  });

  it("yerel gelistirme adresinde de calisiyor", () => {
    expect(inviteTokenFrom("http://192.168.1.107:3000/join/xyz")).toBe("xyz");
  });

  it("bos metinde null donuyor", () => {
    expect(inviteTokenFrom("   ")).toBeNull();
  });

  it("kodu olmayan bir baglantida null donuyor", () => {
    expect(inviteTokenFrom("https://owezy.net/join/")).toBeNull();
  });
});
