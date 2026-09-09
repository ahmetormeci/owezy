import Link from "next/link";
import { PublicControls } from "@/components/public-controls";
import { getTranslate } from "@/lib/i18n-server";
import { cn } from "@/lib/utils";

/**
 * Uygulamanin DISINDAKI dort sayfanin ortak iskeleti: /sign-in, /sign-up,
 * /reset-password ve /join/[token].
 *
 * ONCEDEN HER BIRI KENDI <Card>'ini kuruyordu. reset-password'un ustundeki
 * yorum bunu zaten fark etmisti - "Sayfa iskeleti /sign-in ve /sign-up ile
 * AYNI" - ama ayniligi bir bilesen degil, KOPYA tasiyordu; kopyalanan bir
 * iskelet zamanla ayrisan bir iskelettir.
 *
 * KART NEDEN GITTI: <Card> bir halka (ring-1) ve yuvarlak kose veriyor, yani
 * sayfadan AYRI bir yuzey. Kagit & petrol yonunde (ADR-048) yuzey tek: kagidin
 * kendisi. Tanitim sayfasi zaten oyle; kullanici "Giris yap"a bastiginda
 * malzeme DEGISIYORDU. Mobilde de kart yok - orada da kelime isareti ve
 * altinda dogrudan form var (mobile/app/sign-in.tsx).
 *
 * KELIME ISARETI SERIF VE 2.5rem: mobil giris ekraniyla ayni olcu ve ayni
 * aile. Bir baglanti, cunku bu dort sayfada basliktaki gezinme YOK - "/"a
 * donmenin baska yolu tarayicinin geri dugmesi olurdu.
 *
 * BASLIK BAKIR CIZGININ USTUNDE, ALTINDA DEGIL - ve bu bir olcumden cikti.
 * Once cizginin altindaydi ve hemen ardindan formun ilk alan etiketi
 * geliyordu: "GIRIS YAP" ile "E-POSTA" ayni bicimde, alt alta iki bakir
 * etiket. Sayfa basligi bir alan etiketi gibi okunuyordu. Cizgi artik
 * ikisinin ARASINDA duruyor, yani kimlik + baslik ustte, is altta.
 *
 * HEPSI SOLA DAYALI - davet sayfasi dahil. Sutun sayfada ortalaniyor ama
 * icerik ortalanmiyor: fis dilinde her sey sola dayanir ve cizgiler tam
 * genislikte durur. (Mobil davet ekrani ortali; orada sutun yok, ekranin
 * kendisi sutun.)
 */
export async function AuthShell({
  label,
  className,
  children,
}: {
  /**
   * Sayfa basligi. VERILDIGINDE <h1 className="cap"> olarak ciziliyor:
   * kelime isareti zaten "burasi Owezy" diyor, bu satirin isi yalnizca
   * AYIRMAK - giris mi, kayit mi, parola mi.
   *
   * Davet sayfasi bunu KULLANMIYOR ve kullanamaz: oradaki baslik bir etiket
   * degil cumle ("... grubuna davet edildin"). .cap kucuk, genis aralikli ve
   * buyuk harf; bir cumleyi oyle dizmek okunmaz yapar. O sayfa kendi serif
   * <h1>'ini govdede tasiyor.
   */
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const t = await getTranslate();

  return (
    <div className="paper relative flex flex-1 flex-col items-center justify-center p-6">
      <div className="paper-grain" aria-hidden />
      <PublicControls />

      <div className={cn("relative w-full max-w-sm", className)}>
        <Link
          href="/"
          className="font-heading inline-block rounded-[3px] text-[2.5rem] leading-none text-brand outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t("ui.app_name")}
        </Link>

        {label ? <h1 className="cap mt-3">{label}</h1> : null}

        {/* Bakir cizgi bolum ustu sac teli (ADR-048): kimlik burada biter,
            is burada baslar. */}
        <div className="mt-5 flex flex-col gap-5 border-t border-copper pt-5">
          {children}
        </div>
      </div>
    </div>
  );
}
