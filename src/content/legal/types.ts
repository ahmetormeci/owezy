import type { Locale } from "@/lib/locale";

/**
 * Gizlilik politikasi ve destek sayfasinin metni.
 *
 * NEDEN messages.ts'TE DEGIL: o sozluk ARAYUZ ETIKETLERI icin ve istemciye
 * gonderiliyor. Iki dilde birkac bin kelimelik dokuman metnini oraya koymak
 * her sayfanin paketini sisirirdi. Buradaki metinler yalnizca Server
 * Component'te okunuyor, yani istemci paketine hic inmiyorlar.
 *
 * ADR-020'NIN GARANTISI KORUNUYOR: asagidaki belgeler
 * Record<Locale, LegalDocument> olarak tiplendigi icin bir dil eksik kalirsa
 * DERLEME HATASI olusuyor - sozlukteki kuralla ayni.
 */

export type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] };

export type LegalSection = {
  heading: string;
  blocks: LegalBlock[];
};

export type LegalDocument = {
  title: string;
  /** Sayfanin <meta description> metni. */
  description: string;
  /** ISO tarih ("2026-08-25"). Gosterimde locale'e gore bicimleniyor. */
  updated: string;
  /** Basligin hemen altindaki giris paragrafi. */
  intro: string;
  sections: LegalSection[];
};

export type LegalDocumentByLocale = Record<Locale, LegalDocument>;
