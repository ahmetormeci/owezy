import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { PRIVACY_POLICY } from "@/content/legal/privacy";
import { getLocale, getTranslate } from "@/lib/i18n-server";

// Giris GEREKTIRMIYOR: bu sayfa (app) grubunun disinda, yani auth kontrolu
// olan duzenin altinda degil. Sart - App Store ve Play, gizlilik politikasi
// adresine giris yapmadan ulasabilmeyi bekliyor ve inceleyici de oyle bakiyor.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const document = PRIVACY_POLICY[locale];
  return { title: document.title, description: document.description };
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const t = await getTranslate();

  return (
    <LegalPage
      document={PRIVACY_POLICY[locale]}
      locale={locale}
      footer={[
        { href: "/support", label: t("ui.support") },
        { href: "/", label: t("ui.back_home") },
      ]}
    />
  );
}
