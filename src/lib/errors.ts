import type { MessageCode, MessageParams } from "@/lib/messages";

// Hatalar artik METIN degil KOD tasiyor (ADR-017). Kodu okunabilir metne
// cevirmek okuyan tarafin isi: web istemcisi Turkce gosterir, mobil istemci
// kendi diliyle gosterir, sunucu hicbirini bilmek zorunda kalmaz.
//
// Error'un kendi "message" alanina kodu yaziyoruz. Boylece Sentry'de ve
// sunucu loglarinda anlamli bir sey goruyoruz ("group.not_found"), ayrica
// bir alan tasimaya gerek kalmiyor.
//
// MessageCode tipi sozlukten turedigi icin var olmayan bir kod yazmak
// derleme hatasi. "Cevirisi eksik kod" durumu bu yuzden olusamiyor.
export class AppError extends Error {
  status: number;
  code: MessageCode;
  params?: MessageParams;

  constructor(code: MessageCode, status: number, params?: MessageParams) {
    super(code);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.params = params;
  }
}

export class NotFoundError extends AppError {
  constructor(code: MessageCode, params?: MessageParams) {
    super(code, 404, params);
  }
}

export class ForbiddenError extends AppError {
  constructor(code: MessageCode, params?: MessageParams) {
    super(code, 403, params);
  }
}

export class ConflictError extends AppError {
  constructor(code: MessageCode, params?: MessageParams) {
    super(code, 409, params);
  }
}

export class ValidationError extends AppError {
  constructor(code: MessageCode, params?: MessageParams) {
    super(code, 400, params);
  }
}
