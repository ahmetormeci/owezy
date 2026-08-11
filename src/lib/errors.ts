export class AppError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Kayıt bulunamadı") {
    super(message, 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Bu işlem için yetkiniz yok") {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Çakışma") {
    super(message, 409);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Geçersiz istek") {
    super(message, 400);
  }
}
