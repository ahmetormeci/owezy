import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { findCurrentUser } from "@/lib/auth";

/**
 * Dil ve tema dugmeleri, giris yapilmamis sayfalar icin.
 *
 * NEDEN VAR: bu iki dugme (app) basligindaydi, yani yalnizca giris yapmis
 * kullanici erisebiliyordu. Iki sozluk de Turkce oldugu surece zararsizdi;
 * Ingilizce sozluk geldigi anda, Ingilizce bir ekrani goren ziyaretci dili
 * degistiremez hale gelirdi - hem de tam giris yapmadan once.
 *
 * KONUMU ONU KOYAN SAYFA BELIRLIYOR, bu bilesen degil. Eskiden kendisi
 * "fixed" ile sag ust koseye yerlesiyordu ve her sayfada ayni yerde
 * duruyordu. 15 Kasim'da olculdu (7 sayfa x 10 ekran boyutu):
 *   - Giris, kayit, parola ve davet sayfalari neredeyse hic kaymiyor ve
 *     sutun ortada: sabit kosede altindan hicbir sey gecmiyor. Orada
 *     sabit kaldi (auth-shell.tsx).
 *   - Gizlilik ve destek uzun metin: arkasi seffaf sabit dugmelerin
 *     altindan kaydirirken yazi geciyordu ("ortak" -> "ortEN"). Orada
 *     dugmeler sayfanin ust satirinda ve sayfayla birlikte kayiyor
 *     (legal-page.tsx).
 */
export async function PublicControls() {
  /**
   * OTURUM VAR MI - dil dugmesi tercihi hesaba da yazsin mi diye.
   *
   * "Giris yapilmamis sayfalar" demek "giris yapmamis ziyaretci" demek
   * DEGIL: gizlilik, destek ve ozellikle davet linki sayfasina giris yapmis
   * kullanici da geliyor ve orada dil tercihi hesaba yazilmali. O yuzden
   * karar sayfanin turune gore degil oturuma gore veriliyor.
   *
   * MALIYET: findCurrentUser cache()'li - davet sayfasi ve getLocale() ayni
   * istekte zaten soruyorsa ek sorgu yok. Cikis yapmis ziyaretcide oturum
   * cerezi olmadigi icin veritabanina hic gidilmiyor.
   */
  const signedIn = (await findCurrentUser()) !== null;

  return (
    <div className="flex items-center gap-1">
      <LanguageToggle saveToAccount={signedIn} />
      <ThemeToggle />
    </div>
  );
}
