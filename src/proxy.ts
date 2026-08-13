import { clerkMiddleware } from "@clerk/nextjs/server";

// Next.js 16 bu dosya kurallini "middleware" -> "proxy" olarak yeniden
// adlandirdi. Ozellik ayni; isim degisti cunku "middleware" Express.js'teki
// anlamla karistiriliyordu. Eski ad hala calisiyor ama deprecated.
//
// Dosya src/ altinda, app/ ile AYNI seviyede olmak zorunda.
//
// Proxy Node.js runtime'inda calisir ve "runtime" config secenegi burada
// KULLANILAMAZ - verilirse Next hata firlatir.
//
// BU DOSYA HICBIR ROUTE'U KORUMAZ. Tek isi Clerk'in oturum bilgisini (auth
// context) her istekte kullanilabilir kilmak. Giris kontrolu sayfanin
// kendisinde: (app)/layout.tsx. Gerekcesi ARCHITECTURE.md'de - yol
// eslestirmesi Next'in gercek yonlendirmesinden sapabilir ve korunmasi
// gereken bir sayfa acikta kalabilir.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
