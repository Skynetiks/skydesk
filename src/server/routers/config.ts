import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import { testImapConnection } from "@/lib/imap-email-checker";
import { verifyEmailConnection } from "@/lib/email";

export const configRouter = createTRPCRouter({
  // Get all configurations
  getAll: protectedProcedure.query(async ({ ctx }) => {
    // Only admins can view configurations
    if (ctx.session.user.role !== "ADMIN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only admins can view configurations",
      });
    }

    const configs = await ctx.db.configuration.findMany({
      orderBy: {
        key: "asc",
      },
    });

    return configs;
  }),

  // Get a specific configuration
  getByKey: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      // Only admins can view configurations
      if (ctx.session.user.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can view configurations",
        });
      }

      const config = await ctx.db.configuration.findUnique({
        where: { key: input.key },
      });

      return config;
    }),

  // Create or update configuration
  upsert: protectedProcedure
    .input(
      z.object({
        key: z.string(),
        value: z.string(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Only admins can modify configurations
      if (ctx.session.user.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can modify configurations",
        });
      }

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
  delete: protectedProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Only admins can delete configurations
      if (ctx.session.user.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can delete configurations",
        });
      }

      await ctx.db.configuration.delete({
        where: { key: input.key },
      });

      return { success: true };
    }),

  // Test IMAP connection
  testImap: protectedProcedure.mutation(async ({ ctx }) => {
    // Only admins can test IMAP connection
    if (ctx.session.user.role !== "ADMIN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only admins can test IMAP connection",
      });
    }

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
  testSmtp: protectedProcedure.mutation(async ({ ctx }) => {
    // Only admins can test SMTP connection
    if (ctx.session.user.role !== "ADMIN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only admins can test SMTP connection",
      });
    }

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
