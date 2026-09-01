/**
 * Yapistirilan metinden davet kodunu cikarir.
 *
 * NEDEN VAR: davet KABUL ETMEK mobilde yoktu ve yazili gerekce universal
 * link kurulumuydu. O kurulum bugun de yapilabilir degil - uc sey birden
 * istiyor (alan adinda apple-app-site-association dosyasi, App ID'de
 * Associated Domains yetkisi, yeni bir build) ve UCUNCUSU onemli: universal
 * link EXPO GO'DA CALISMIYOR, yani simulatorde acip bakilamiyordu. Bu
 * projede gorulmeden yazilan seyin nasil sonuclandigini biliyoruz.
 *
 * Yapistirma yolu bugun calisiyor ve universal link sonradan geldiginde bu
 * dosya DEGISMEZ: derin baglanti yalnizca alani onceden doldurur.
 *
 * BICIM DOGRULAMASI YOK, bilerek. Kodun gecerliligine SUNUCU karar veriyor
 * (hash'leyip ariyor) ve gecersizse "invite.invalid" gibi anlasilir bir
 * cevap donuyor. Burada bir desen tutturmaya calismak, sunucunun kabul
 * edecegi bir kodu istemcide reddetme riski demekti.
 */
const MARKER = "/join/";

export function inviteTokenFrom(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  // Baglanti yapistirildiysa kod "/join/" ile son bulan kismin ARDINDA.
  // lastIndexOf: adresin baska bir yerinde de gecebilir diye sondan bakiyoruz.
  const marker = trimmed.lastIndexOf(MARKER);
  const candidate = marker === -1 ? trimmed : trimmed.slice(marker + MARKER.length);

  // Kuyruk atiliyor: sorgu dizesi, cipa, sondaki egik cizgi ve bosluk.
  // Paylasim uygulamalarinin adresin arkasina metin eklemesi yaygin.
  const token = candidate.split(/[?#/\s]/)[0];
  return token.length > 0 ? token : null;
}
