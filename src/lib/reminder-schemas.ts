import { z } from "zod";

/**
 * Hatirlatmalar arasindaki en kisa sure (ADR-050).
 *
 * SEMA DOSYASINDA cunku bu bir API SOZLESMESI: sunucu bu sureden once gelen
 * istegi reddediyor, istemci de ayni sure boyunca dugmeyi kapatiyor. Servis
 * katmani (reminders.ts) ve iki istemci de degeri buradan okuyor - iki yerde
 * yazilsaydi bir gun biri 24, digeri 12 olurdu ve dugme "hazir" derken
 * sunucu "erken" derdi.
 */
export const REMINDER_COOLDOWN_HOURS = 24;

/**
 * Hatirlatma govdesi: yalnizca KIME.
 *
 * TUTAR ISTEMCIDEN ALINMIYOR - currency kuralinin (ADR-006) aynisi. Tutari
 * istemci gonderseydi "sana 9.999 TL borcun var" diyen bir hatirlatma
 * gonderilebilirdi; sunucu tutari her zaman kendi hesapladigi odesme
 * planindan okuyor.
 */
export const createReminderSchema = z.object({
  toUserId: z.uuid(),
});
