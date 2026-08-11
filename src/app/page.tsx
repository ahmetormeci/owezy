import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { BrandMark } from "@/components/brand-mark";
import { formatSignedMoney } from "@/lib/money";

// Karsilama sayfasindaki ornek defter. Gercek veri DEGIL - uygulamanin ne
// yaptigini bir paragraf yazmak yerine gostermek icin duruyor. Ayni
// formatSignedMoney'den geciyor, yani ekranda gorunen hizalama ve isaretler
// uygulamanin gercek davranisiyla birebir ayni.
const SAMPLE_ROWS = [
  { name: "Ayşe", amount: 24000 },
  { name: "Mehmet", amount: -12000 },
  { name: "Zeynep", amount: -12000 },
];

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/groups");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16">
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex items-center gap-3">
          <BrandMark className="size-10 text-brand" />
          <h1 className="text-display font-semibold">SplitApp</h1>
        </div>
        <p className="max-w-md text-balance text-muted-foreground">
          Grup harcamalarını kaydet, kimin kime ne kadar borçlu olduğunu tek
          bakışta gör.
        </p>
      </div>

      <div className="w-full max-w-sm rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
        <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
          <span className="font-medium">Kahvaltı</span>
          <span className="money text-muted-foreground">360,00 ₺</span>
        </div>
        <ul className="flex flex-col divide-y divide-border">
          {SAMPLE_ROWS.map((row) => (
            <li key={row.name} className="flex items-center justify-between gap-4 py-2.5">
              <span>{row.name}</span>
              <span
                className={`money font-medium ${
                  row.amount > 0 ? "text-credit" : "text-debt"
                }`}
              >
                {formatSignedMoney(row.amount)}
              </span>
            </li>
          ))}
        </ul>
        <p className="pt-3 text-xs text-muted-foreground">
          Örnek — gerçek bir gruba ait değil
        </p>
      </div>

      <div className="flex gap-3">
        <Link
          href="/sign-up"
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors outline-none hover:bg-brand-strong focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Kayıt ol
        </Link>
        <Link
          href="/sign-in"
          className="rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Giriş yap
        </Link>
      </div>
    </div>
  );
}
