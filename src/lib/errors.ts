export class AppError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Kayit bulunamadi") {
    super(message, 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Bu islem icin yetkiniz yok") {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Cakisma") {
    super(message, 409);
  }
}
