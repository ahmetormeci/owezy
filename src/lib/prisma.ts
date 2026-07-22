import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL ortam degiskeni bulunamadi.");
}

const adapter = new PrismaNeon({ connectionString });

// Next.js gelistirme modunda (hot reload) her dosya degisikliginde modul
// yeniden yuklenir. globalThis uzerinde saklamazsak, her reload'da yeni bir
// PrismaClient olusur ve Neon baglanti limitini hizla tuketebiliriz.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
