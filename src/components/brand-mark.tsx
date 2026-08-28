// Kimlik isareti: acik bir dis halka ve icinde daha kisa ikinci bir yay.
//
// NE ANLATIYOR: ayni merkez, farkli uzunluklar. Bir hesap ve o hesabin esit
// olmayan paylari. Onceki isaret de bunu anlatiyordu (esit olmayan iki parcaya
// bolunmus dolu bir daire) ama dolu bir disk olarak; bu hali ayni fikri
// konturla kuruyor ve kucuk boyutlarda daha iyi ayakta duruyor.
//
// NEDEN ESIT DEGIL: uygulama yalnizca esit bolusturmuyor - EXACT ve PERCENTAGE
// de var. Ortadan tam ikiye bolunmus bir sey yalnizca EQUAL'i anlatirdi.
//
// currentColor kullaniliyor, yani isaret rengini kendisi SECMIYOR; icinde
// bulundugu metnin rengini aliyor. Bu bir tercih degil, KURAL: ADR-015'e gore
// kimlik rengi kobalt ve yesil/kirmizi yalnizca bakiye anlami tasiyor. Buraya
// sabit bir renk yazmak o ayrimi delerdi.
//
// GEOMETRI 16 PIKSELE GORE AYARLANDI - ve bu sayilar keyfi degil:
//
//   Dis halka r=8.4, kontur 3.2. Ic yay TASARIMDAN GELDIGINDE r=4 idi; iki
//   konturun arasinda 1.2 birim net aciklik birakiyordu. 16 pikselte o aciklik
//   0.80 PIKSEL, yani bir pikselin altinda: iki yay birbirine yapisiyor ve
//   isaret bir lekeye donusuyor. Olculdu, varsayilmadi.
//
//   Ic yaricap 3.6'ya cekildi -> aciklik 1.6 birim -> 16 pikselte 1.07 piksel.
//
//   YANI: en kucuk kullanim 16 PIKSEL (size-4, iki yerde - (app)/layout.tsx ve
//   legal-page.tsx). Konturu kalinlastiran ya da ic yaricapi buyuten bir
//   degisiklik once ORADA denenmeli; 32 pikselte her sey iyi gorunuyor.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="3.2"
      // Yuvarlak uclar bilincli: kesik uclar bu boyutlarda tirtikli goruniyor.
      strokeLinecap="round"
      // Isaret bilgi tasimiyor, yanindaki "Owezy" yazisi tasiyor.
      // Ekran okuyucuya iki kez "Owezy" dedirtmemek icin gizliyoruz.
      aria-hidden="true"
      focusable="false"
    >
      {/* Dis halka: ustten baslayip sol ustte aciliyor - kapanmamis hesap */}
      <path d="M12 3.6A8.4 8.4 0 1 1 4.73 7.8" />
      {/* Ic yay: ayni merkez, kisa pay */}
      <path d="M12 8.4A3.6 3.6 0 0 1 12.62 15.55" />
    </svg>
  );
}
