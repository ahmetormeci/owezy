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

/**
 * Sunucu tarafinda bir sey EKSIK ya da ULASILAMIYOR - istemcinin yaptigi bir
 * sey degil.
 *
 * NEDEN AYRI BIR SINIF: bunlar olmadan her depo sorunu handleApiError'in
 * genel dalina dusuyordu ve ekranda "beklenmeyen bir hata" yaziyordu -
 * yapilandirma eksigiyle gercek bir yazilim hatasi ayirt edilemiyordu.
 * Gercekten yasandi: R2 kurulduktan sonra fis yuklenemedi ve elimizdeki tek
 * bilgi "beklenmeyen"di; sebebi bulmak icin sunucu gunlugune bakmak
 * gerekiyordu.
 *
 * 503: gecici olabilecegini soyleyen dogru durum kodu.
 */
export class ServiceError extends AppError {
  constructor(code: MessageCode, params?: MessageParams) {
    super(code, 503, params);
  }
}

export class ValidationError extends AppError {
  constructor(code: MessageCode, params?: MessageParams) {
    super(code, 400, params);
  }
}
