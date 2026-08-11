// Kimlik isareti: esit olmayan iki parcaya bolunmus bir daire.
//
// Neden esit degil: uygulama harcamalari esit bolusturebiliyor ama EXACT ve
// PERCENTAGE de var. Ortadan tam ikiye bolunmus bir daire yalnizca EQUAL'i
// anlatirdi. Aradaki bosluk da bilerek: iki parca bir butunun parcasi ama
// birbirinden ayri - ayni fisin iki kisiye dusen kismi gibi.
//
// currentColor kullaniliyor, yani isaret rengini kendisi secmiyor; icinde
// bulundugu metnin rengini aliyor. Baslikta kobalt, koyu temada acik kobalt
// olmasi icin ayrica bir sey yapmiyoruz - token sistemi hallediyor.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      // Isaret bilgi tasimiyor, yanindaki "SplitApp" yazisi tasiyor.
      // Ekran okuyucuya iki kez "SplitApp" dedirtmemek icin gizliyoruz.
      aria-hidden="true"
      focusable="false"
    >
      {/* Buyuk parca: x=13'teki kirilmadan sola kalan kisim */}
      <path d="M13 2.05 A10 10 0 1 0 13 21.95 Z" fill="currentColor" />
      {/* Kucuk parca: x=15'ten saga kalan kisim, ayni renk daha soluk */}
      <path
        d="M15 2.46 A10 10 0 0 1 15 21.54 Z"
        fill="currentColor"
        opacity="0.35"
      />
    </svg>
  );
}
