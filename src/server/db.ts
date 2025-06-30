import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Removed query logging to reduce terminal clutter
    // log: ["query"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
