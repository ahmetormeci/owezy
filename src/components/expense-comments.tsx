"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { textareaClassName } from "@/components/ui/input";
import { PersonAvatar } from "@/components/person-avatar";
import { apiRequest } from "@/lib/api-client";
import { useTranslate } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n";
import { formatRelativeTime } from "@/lib/notification-text";
import { MAX_COMMENT_LENGTH } from "@/lib/comment-schemas";

/**
 * Bir harcamanin yorumlari (ADR-049).
 *
 * NEDEN DIYALOG, AYRI BIR SAYFA DEGIL: web'de harcamanin bir DETAY SAYFASI
 * yok - harcama bir liste satiri. Yorum icin sayfa acmak, once o sayfayi
 * icat etmek demekti; diyalog ise web'in her yerinde zaten kullanilan desen
 * (odesme, uye eylemleri, davet). Telefonda karsiligi detay ekraninin
 * altindaki bolum.
 *
 * YORUMLAR ANCAK DIYALOG ACILINCA CEKILIYOR. Listede satir basina yalnizca
 * bir SAYI tasiniyor; kirk harcamalik bir listede kirk sohbeti indirmek
 * fis fotografiyla ayni hataydi.
 */

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: {
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    hasImage: boolean;
  };
};

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; code: string }
  | { kind: "ready"; comments: Comment[]; truncated: boolean };

export function ExpenseComments({
  groupId,
  expenseId,
  description,
  currentUserId,
  commentCount,
  isDeleted,
}: {
  groupId: string;
  expenseId: string;
  description: string;
  currentUserId: string;
  commentCount: number;
  /** Silinmis harcamanin yorumlari OKUNUR ama yenisi yazilamaz. */
  isDeleted: boolean;
}) {
  const t = useTranslate();
  const locale = useLocale();

  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  /** Ekranda gosterilen sayi. Yazip silince tetikleyicinin de degismesi icin. */
  const [count, setCount] = useState(commentCount);

  const base = `/api/v1/groups/${groupId}/expenses/${expenseId}/comments`;

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const data = await apiRequest<{ comments: Comment[]; truncated: boolean }>(base);
      setState({ kind: "ready", comments: data.comments, truncated: data.truncated });
      setCount(data.comments.length);
    } catch (error) {
      setState({
        kind: "error",
        code: error instanceof Error ? error.message : "server.unexpected",
      });
    }
  }, [base]);

  /**
   * Diyalog HER ACILISTA yeniden okuyor. Onbellek tutmuyoruz: bir yorum baska
   * bir cihazdan eklenmis olabilir ve bayat bir sohbet, bos bir sohbetten
   * daha yaniltici.
   *
   * OKUMA EFEKTTE DEGIL, ACILIS OLAYINDA. useEffect(open) ile yazilmisti ve
   * lint hakli olarak reddetti (react-hooks/set-state-in-effect): burada
   * "React disi bir sistemle senkron kalmak" diye bir sey yok, KULLANICI bir
   * sey yapiyor. Olayin yerinde okumak ayni isi zincirleme cizim uretmeden
   * yapiyor.
   */
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) void load();
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || isSending) return;

    setIsSending(true);
    try {
      const data = await apiRequest<{ comment: Comment }>(base, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setDraft("");
      setState((current) =>
        current.kind === "ready"
          ? { ...current, comments: [...current.comments, data.comment] }
          : current,
      );
      setCount((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("server.unexpected"));
    } finally {
      setIsSending(false);
    }
  }

  async function remove(commentId: string) {
    try {
      await apiRequest(`${base}/${commentId}`, { method: "DELETE" });
      setState((current) =>
        current.kind === "ready"
          ? { ...current, comments: current.comments.filter((c) => c.id !== commentId) }
          : current,
      );
      setCount((value) => Math.max(0, value - 1));
      toast.success(t("ui.comment_deleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("server.unexpected"));
    }
  }

  const label =
    count === 0
      ? t("ui.add_comment")
      : count === 1
        ? t("ui.comment_count_one")
        : t("ui.comment_count_other", { count });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="shrink-0 transition-colors hover:text-brand"
          />
        }
      >
        {label}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("ui.comments")}</DialogTitle>
          {/* Hangi harcama oldugunu diyalogun kendisi soylemeli: tetikleyici
              satirdaki kucuk bir baglanti ve diyalog acilinca satir perdenin
              arkasinda kaliyor. */}
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {state.kind === "loading" ? (
          <p className="py-4 text-sm text-muted-foreground">{t("ui.loading")}</p>
        ) : state.kind === "error" ? (
          <p className="py-4 text-sm text-destructive">{t(state.code)}</p>
        ) : (
          <div className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto py-1">
            {state.truncated ? (
              <p className="cap">{t("ui.comments_truncated")}</p>
            ) : null}

            {state.comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("ui.no_comments")}</p>
            ) : (
              state.comments.map((comment) => (
                <div key={comment.id} className="flex gap-2.5">
                  <PersonAvatar
                    displayName={comment.author.displayName}
                    avatarUrl={comment.author.avatarUrl}
                    hasImage={comment.author.hasImage}
                    me={comment.author.userId === currentUserId}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-medium">
                        {comment.author.displayName}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelativeTime(new Date(comment.createdAt), new Date(), t, locale)}
                      </span>
                      {comment.author.userId === currentUserId ? (
                        <button
                          type="button"
                          onClick={() => void remove(comment.id)}
                          className="ml-auto shrink-0 text-xs text-muted-foreground transition-colors hover:text-destructive"
                        >
                          {t("ui.delete_comment")}
                        </button>
                      ) : null}
                    </div>
                    {/* whitespace-pre-line: kullanicinin koydugu satir sonlari
                        korunuyor, ama ardisik bosluklar degil. */}
                    <p className="mt-0.5 text-sm whitespace-pre-line break-words">
                      {comment.body}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {isDeleted ? (
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            {t("ui.comments_closed_deleted")}
          </p>
        ) : (
          <form onSubmit={send} className="flex flex-col gap-2 border-t border-border pt-3">
            <label htmlFor={`comment-${expenseId}`} className="sr-only">
              {t("ui.add_comment")}
            </label>
            <textarea
              id={`comment-${expenseId}`}
              rows={2}
              maxLength={MAX_COMMENT_LENGTH}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t("ui.comment_placeholder")}
              className={textareaClassName}
            />
            <Button type="submit" className="self-end" disabled={!draft.trim() || isSending}>
              {isSending ? t("ui.sending_comment") : t("ui.send_comment")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
