"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { parseMoney } from "@/lib/money";
import { useTranslate } from "@/lib/i18n";

/**
 * Fisin bir sonraki satiri: harcamayi sayfadan cikmadan ekler.
 *
 * NEDEN VAR: bu uygulamanin en sik yapilan isi harcama KAYDETMEK ama o is
 * bugune kadar uc tik oteydeydi (grup -> Harcama ekle -> form -> kaydet).
 * Kahve parasi girmek icin sayfa degistirmek, kaydin hic girilmemesine yol
 * aciyor.
 *
 * NEDEN FORMUN YERINI ALMIYOR: burada YALNIZCA en yaygin durum var - esit
 * bolusum, odeyen sensin, tarih bugun, kategori Diger. Odeyeni, tarihi,
 * kategoriyi ya da bolusum tipini degistirmek isteyen tam forma gidiyor.
 * Satir ici girisin varsayimlarini kullanicidan GIZLEMEK yerine yaziyoruz:
 * bir sey yazmaya baslayinca altta ne olacagi cikiyor.
 */
export function ExpenseComposer({
  groupId,
  memberIds,
  currentUserId,
}: {
  groupId: string;
  /** Grubun AKTIF uyeleri. Ayrilmis uye yeni bolusume giremez. */
  memberIds: string[];
  currentUserId: string;
}) {
  const t = useTranslate();
  const router = useRouter();

  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amount = parseMoney(amountText);
  const isDirty = description.trim() !== "" || amountText.trim() !== "";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    // Dogrulama tam formdakiyle AYNI mesajlari kullaniyor: iki ayri yerde
    // "tutar hatali" demenin iki ayri yolu olmasi, ayni hatanin iki farkli
    // his vermesi demek.
    if (!description.trim()) {
      toast.error(t("ui.description_required"));
      return;
    }
    if (amountText.trim() !== "" && amount === null) {
      toast.error(t("ui.amount_unreadable"));
      return;
    }
    if (amount === null || amount <= 0) {
      toast.error(t("ui.amount_required"));
      return;
    }

    // Tarih tam formdaki varsayilanla ayni sekilde uretiliyor.
    const today = new Date().toISOString().slice(0, 10);

    setIsSubmitting(true);
    try {
      await apiRequest(`/api/v1/groups/${groupId}/expenses`, {
        method: "POST",
        body: JSON.stringify({
          description: description.trim(),
          amount,
          paidById: currentUserId,
          category: "OTHER",
          expenseDate: today,
          splitType: "EQUAL",
          participantUserIds: memberIds,
        }),
      });

      toast.success(t("ui.expense_added"));
      setDescription("");
      setAmountText("");
      // Bugunun ayina donuyoruz: fiste acik ay baska bir ay olabilir ve
      // kullanici az once ekledigi satiri goremezdi (Faz 16.2).
      router.push(`/groups/${groupId}?month=${today.slice(0, 7)}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("server.unexpected"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      {/* Kagidin bir sonraki satiri: ayni noktali ayrac, ayni hizalama.
          Kenarliksiz girdiler bilerek - kutu cizmek, satirin fisin parcasi
          degil uzerine konmus bir arayuz oldugunu soylerdi. */}
      <div className="flex items-baseline border-b border-foreground pb-2 text-sm">
        <Plus className="size-3.5 shrink-0 translate-y-0.5 text-muted-foreground" aria-hidden="true" />
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t("ui.composer_placeholder")}
          // Erisilebilir ad tam formdakinden AYRI olmali: ayni sayfada iki
          // "Aciklama" alani (bu satir + grup duzenleme penceresi) hem ekran
          // okuyucuda belirsizlik hem de testlerde cift eslesme uretiyordu.
          // Satir ici giris zaten soru diliyle konusuyor; adi da o.
          aria-label={t("ui.composer_placeholder")}
          maxLength={200}
          disabled={isSubmitting}
          className="ml-2 min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground focus-visible:placeholder:text-transparent"
        />
        <span aria-hidden="true" className="leader" />
        <input
          value={amountText}
          onChange={(event) => setAmountText(event.target.value)}
          inputMode="decimal"
          placeholder="0,00"
          aria-label={t("ui.composer_amount")}
          disabled={isSubmitting}
          className="money w-24 shrink-0 bg-transparent text-right outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Varsayimlar ve gonder dugmesi yalnizca yazmaya baslayinca cikiyor:
          bos fis tek temiz satir olarak duruyor, kullanici yazmaya
          basladiginda ne olacagini soyluyoruz. */}
      {isDirty ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{t("ui.composer_hint")}</p>
          <button
            type="submit"
            disabled={isSubmitting}
            className="cap rounded-[4px] bg-brand px-3 py-1.5 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting ? t("ui.saving") : t("ui.composer_submit")}
          </button>
        </div>
      ) : null}
    </form>
  );
}
