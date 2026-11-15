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
 * Karsilama, giris, kayit ve davet sayfalarinin ortak bir basligi yok
 * (dordu de dogrudan kok layout'un altinda), o yuzden konumu kendisi
 * belirliyor. 11.6 bu sayfalari elden gecirdiginde burasi da yeniden
 * degerlendirilmeli: dar ekranda ust ortadaki bir kartla cakisabilir.
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
    <div className="fixed top-2 right-3 z-40 flex items-center gap-1">
      <LanguageToggle saveToAccount={signedIn} />
      <ThemeToggle />
    </div>
  );
}
