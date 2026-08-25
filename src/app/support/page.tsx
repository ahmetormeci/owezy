import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { SUPPORT_PAGE } from "@/content/legal/support";
import { getLocale, getTranslate } from "@/lib/i18n-server";

// Gizlilik sayfasiyla ayni sebep: giris gerektirmiyor. App Store'un "Support
// URL" alani zorunlu ve o adres herkese acik olmak zorunda.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const document = SUPPORT_PAGE[locale];
  return { title: document.title, description: document.description };
}

export default async function SupportPage() {
  const locale = await getLocale();
  const t = await getTranslate();

  return (
    <LegalPage
      document={SUPPORT_PAGE[locale]}
      locale={locale}
      footer={[
        { href: "/privacy", label: t("ui.privacy") },
        { href: "/", label: t("ui.back_home") },
      ]}
    />
  );
}
