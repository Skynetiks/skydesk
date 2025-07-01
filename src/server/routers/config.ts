import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import { testImapConnection } from "@/lib/imap-email-checker";
import { verifyEmailConnection } from "@/lib/email";

export const configRouter = createTRPCRouter({
  // Get all configurations
  getAll: adminProcedure.query(async ({ ctx }) => {
    const configs = await ctx.db.configuration.findMany({
      orderBy: {
        key: "asc",
      },
    });

    return configs;
  }),

  // Get a specific configuration
  getByKey: adminProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      const config = await ctx.db.configuration.findUnique({
        where: { key: input.key },
      });

      return config;
    }),

  // Create or update configuration
  upsert: adminProcedure
    .input(
      z.object({
        key: z.string(),
        value: z.string(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const config = await ctx.db.configuration.upsert({
        where: { key: input.key },
        update: {
          value: input.value,
          description: input.description,
          updatedBy: ctx.session.user.id!,
        },
        create: {
          key: input.key,
          value: input.value,
          description: input.description,
          updatedBy: ctx.session.user.id!,
        },
      });

      return config;
    }),

  // Delete configuration
  delete: adminProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.configuration.delete({
        where: { key: input.key },
      });

      return { success: true };
    }),

  // Test IMAP connection
  testImap: adminProcedure.mutation(async () => {
    const success = await testImapConnection();

    if (!success) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "IMAP connection test failed. Please check your configuration.",
      });
    }

    return { success: true };
  }),

  // Test SMTP connection
  testSmtp: adminProcedure.mutation(async () => {
    const success = await verifyEmailConnection();

    if (!success) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "SMTP connection test failed. Please check your configuration.",
      });
    }

    return { success: true };
  }),
});
