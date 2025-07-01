import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  adminProcedure,
} from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";

export const userRouter = createTRPCRouter({
  // Get all users (admin only)
  getAll: adminProcedure.query(async ({ ctx }) => {
    const users = await ctx.db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            assignedTickets: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return users;
  }),

  // Get current user
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return user;
  }),

  // Create a new user (admin only)
  create: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(2),
        password: z.string().min(6),
        role: z.enum(["ADMIN", "USER"]).default("USER"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user already exists
      const existingUser = await ctx.db.user.findUnique({
        where: { email: input.email },
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User with this email already exists",
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(input.password, 12);

      const user = await ctx.db.user.create({
        data: {
          email: input.email,
          name: input.name,
          password: hashedPassword,
          role: input.role,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      });

      return user;
    }),

  // Update user (admin only, or user can update their own profile)
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        email: z.string().email().optional(),
        name: z.string().min(2).optional(),
        role: z.enum(["ADMIN", "USER"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      // Users can only update their own profile, admins can update any user
      if (ctx.session.user.role !== "ADMIN" && ctx.session.user.id !== id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only update your own profile",
        });
      }

      // Only admins can change roles
      if (updateData.role && ctx.session.user.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can change user roles",
        });
      }

      const user = await ctx.db.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      });

      return user;
    }),

  // Delete user (admin only)
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Prevent admin from deleting themselves
      if (ctx.session.user.id === input.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete your own account",
        });
      }

      // Check if user has assigned tickets
      const assignedTickets = await ctx.db.ticket.findMany({
        where: { assignedToId: input.id },
      });

      if (assignedTickets.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete user with assigned tickets",
        });
      }

      await ctx.db.user.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  // Get user's assigned tickets
  getAssignedTickets: protectedProcedure
    .input(
      z.object({
        userId: z.string().optional(),
        status: z
          .enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = input.userId || ctx.session.user.id;

      // Users can only see their own tickets, admins can see any user's tickets
      if (ctx.session.user.role !== "ADMIN" && ctx.session.user.id !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only view your own assigned tickets",
        });
      }

      const tickets = await ctx.db.ticket.findMany({
        where: {
          assignedToId: userId,
          status: input.status,
        },
        include: {
          messages: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return tickets;
    }),
});
