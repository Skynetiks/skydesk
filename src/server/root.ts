import { createTRPCRouter } from "@/server/trpc";
import { ticketRouter } from "@/server/routers/ticket";
import { userRouter } from "@/server/routers/user";
import { configRouter } from "@/server/routers/config";

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
