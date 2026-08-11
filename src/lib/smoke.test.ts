import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";

describe("vitest kurulumu", () => {
  it("temel bir esitligi dogrular", () => {
    expect(1 + 1).toBe(2);
  });

  it("@/ path alias'i ile mevcut proje kodunu import edebiliyor", () => {
    const error = new AppError("server.unexpected", 418);
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(418);
  });
});
