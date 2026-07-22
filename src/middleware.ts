import { clerkMiddleware } from "@clerk/nextjs/server";

// Su an sadece Clerk'in oturum bilgisini (auth context) her istekte
// kullanilabilir hale getiriyoruz. Hangi route'larin giris zorunlu
// kilacagini (auth.protect()), gruplar/harcamalar gibi gercek
// sayfalari yazarken burada netlestirecegiz.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
