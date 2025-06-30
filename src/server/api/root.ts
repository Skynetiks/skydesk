import { createTRPCRouter } from "@/server/api/trpc";
import { ticketRouter } from "@/server/api/routers/ticket";
import { userRouter } from "@/server/api/routers/user";
import { configRouter } from "@/server/api/routers/config";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  ticket: ticketRouter,
  user: userRouter,
  config: configRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
