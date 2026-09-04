import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { LOCALE_COOKIE } from "@/lib/locale";
import { apiBaseUrl } from "../lib/api";
import { useSession } from "../lib/auth";
import { filenameFromContentDisposition } from "../lib/content-disposition";
import { useLocale, useTranslate } from "../lib/i18n";
import { useTheme, type Theme } from "../lib/theme";
import { Cap } from "./receipt";

/**
 * Suzulmus harcama listesini CSV olarak disa aktarir.
 *
 * NEDEN SUZGEC SATIRINDA: web'de de orada (expense-list.tsx) ve bu BILINCLI -
 * disa aktarma ekrandaki filtreyi izliyor, yani suzulmus bir liste dururken
 * butun grubu indirmek kullaniciyi sasirtirdi. Dugmeyi filtreden uzaga
 * koymak o bagi gorunmez yapardi.
 *
 * NEDEN SUZGEC PANELININ ICINDE DEGIL: mobilde panel varsayilan olarak
 * KAPALI. Icine konsaydi, filtrelemek istemeyen kullanici disa aktarmayi hic
 * bulamazdi. Web'de de satir her zaman gorunur.
 *
 * NEDEN useApiClient KULLANILMIYOR: o istemci cevabi JSON olarak cozuyor,
 * buradan gelen ise ham CSV. Belirteci useSession'dan alip fetch'i elle
 * kuruyoruz - lib/api.ts'in Bearer sozlesmesi (ADR-029) aynen korunuyor.
 *
 * DOSYA ADI SUNUCUDAN: Content-Disposition'dan okunuyor (bkz.
 * lib/content-disposition.ts). Istemcide uretseydik web'den ve telefondan
 * inen dosyalar farkli adlar tasirdi.
 */
export function CsvExport({
  groupId,
  filterSuffix,
  onError,
}: {
  groupId: string;
  filterSuffix: string;
  onError: (message: string | null) => void;
}) {
  const { getToken } = useSession();
  const t = useTranslate();
  const locale = useLocale();
  const theme = useTheme();
  const s = styles(theme);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (busy) return;
    setBusy(true);
    onError(null);

    try {
      const token = await getToken();
      const url =
        `${apiBaseUrl()}/api/v1/groups/${groupId}/expenses/export` +
        (filterSuffix ? `?${filterSuffix}` : "");

      const response = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          /**
           * DILI CEREZLE SOYLUYORUZ - ve sunucuda HICBIR SEY DEGISMIYOR.
           *
           * Uc dili zaten sirasiyla cereze, sonra hesabin tercihine bakarak
           * cozuyor (i18n-server.ts). Web bu yolu kullaniyor ve yol test
           * edilmis. Mobil normalde cerez gondermiyor (ADR-029: oturum
           * Bearer ile geciyor), o yuzden orada hesabin dili kaziniyordu -
           * oysa arayuz CIHAZIN dilini gosteriyor. Simulatorde goruldu:
           * uygulama Ingilizceyken inen dosyanin basliklari Turkce cikti.
           *
           * ONCE UCA "locale" PARAMETRESI EKLENDI VE GERI ALINDI. Degisiklik
           * masum gorunuyordu - hatta cookies() cagrisini azaltiyordu - ama
           * o commit ile E2E collaboration testleri duzenli olarak dusuyordu
           * (5 kosuda dustu, degisikliksiz 3 kosuda gecti) ve MEKANIZMASI
           * BULUNAMADI. Aciklanamayan bir riski uretime tasimaktansa,
           * sunucuya hic dokunmayan bu yol secildi.
           *
           * BU CEREZ OTURUM TASIMIYOR: yalnizca sunum tercihi. ADR-029'un
           * konusu oturumun Bearer ile gecmesi, o kural delinmiyor.
           */
          Cookie: `${LOCALE_COOKIE}=${locale}`,
        },
      });

      if (!response.ok) {
        onError(t("server.unexpected"));
        return;
      }

      /**
       * METIN OLARAK OKUNUYOR ve BOM KORUNUYOR. Uc cevabin basina "﻿"
       * koyuyor (lib/csv.ts) cunku Excel onsuz UTF-8'i taniyamiyor ve Turkce
       * harfler bozuluyor. response.text() BOM'u oldugu gibi veriyor;
       * ayiklamak dosyayi Excel'de bozardi.
       */
      const csv = await response.text();

      const name =
        filenameFromContentDisposition(response.headers.get("content-disposition")) ??
        "owezy.csv";

      /**
       * ONBELLEK DIZINI, belgeler degil: bu dosya paylasim sayfasina
       * verilecek gecici bir kopya. Belgelere yazmak, kullanicinin
       * silemedigi bir yerde birikmesi demekti.
       */
      const file = new File(Paths.cache, name);
      // Ayni grup ikinci kez disa aktarilinca ad AYNI oluyor; create()
      // varolan dosyada firlatiyor.
      if (file.exists) file.delete();
      file.create();
      file.write(csv);

      if (!(await Sharing.isAvailableAsync())) {
        onError(t("server.unexpected"));
        return;
      }

      await Sharing.shareAsync(file.uri, {
        mimeType: "text/csv",
        // iOS paylasim sayfasi TURU BUNDAN okuyor; verilmezse dosya
        // "bilinmeyen" olarak gorunuyor ve Numbers/Excel onerilmiyor.
        UTI: "public.comma-separated-values-text",
        dialogTitle: t("ui.export_csv"),
      });
    } catch {
      // Ag hatasi ya da dosya yazilamadi. Ham hata metni degil, sozlukteki
      // cumle - kullaniciya "TypeError: Network request failed" gostermek
      // hicbir sey anlatmaz.
      onError(t("server.offline"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable onPress={() => void run()} disabled={busy} hitSlop={8} style={s.button}>
      {busy ? (
        <ActivityIndicator color={theme.muted} size="small" />
      ) : (
        // Ok isareti web'deki baglantinin aynisi: "bir sey inecek" demenin
        // en kisa yolu.
        <Cap color={theme.muted}>{`${t("ui.export_csv")} ↓`}</Cap>
      )}
    </Pressable>
  );
}

function styles(theme: Theme) {
  return StyleSheet.create({
    // Yukleme gostergesi metinle AYNI yeri kaplasin ki satir oynamasin.
    button: { minWidth: 64, alignItems: "flex-end", justifyContent: "center" },
  });
}
