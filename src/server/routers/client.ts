import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import * as XLSX from "xlsx";

const clientInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  emails: z
    .array(z.string().email("Invalid email format"))
    .min(1, "At least one email is required"),
  phone: z.array(z.string()).optional().default([]),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

const updateClientSchema = clientInputSchema.partial().extend({
  id: z.string().cuid(),
});

export const clientRouter = createTRPCRouter({
  // Get all clients with infinite query support
  getAll: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().nullish(),
        search: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, search, isActive } = input;

      const where: {
        OR?: Array<{
          name?: { contains: string; mode: "insensitive" };
          companyName?: { contains: string; mode: "insensitive" };
          emails?: { hasSome: string[] };
        }>;
        isActive?: boolean;
      } = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" as const } },
          {
            companyName: { contains: search, mode: "insensitive" as const },
          },
          { emails: { hasSome: [search] } },
        ];
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      const items = await ctx.db.client.findMany({
        where,
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              tickets: true,
            },
          },
        },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem!.id;
      }

      return {
        items,
        nextCursor,
      };
    }),

  // Get client by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const client = await ctx.db.client.findUnique({
        where: { id: input.id },
        include: {
          tickets: {
            include: {
              assignedTo: true,
              createdBy: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!client) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Client not found",
        });
      }

      return client;
    }),

  // Debug: Get all clients with their emails (temporary)
  debugGetAllClients: protectedProcedure.query(async ({ ctx }) => {
    const clients = await ctx.db.client.findMany({
      select: {
        id: true,
        name: true,
        emails: true,
        companyName: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return clients;
  }),

  // Get all clients for campaign selection (no pagination, optimized for campaigns)
  getAllForCampaigns: protectedProcedure
    .input(
      z.object({
        isActive: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { isActive } = input;

      const where: {
        isActive?: boolean;
      } = {};

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      const clients = await ctx.db.client.findMany({
        where,
        select: {
          id: true,
          name: true,
          emails: true,
          companyName: true,
          isActive: true,
        },
        orderBy: { name: "asc" },
      });

      return clients;
    }),

  // Create new client
  create: adminProcedure
    .input(clientInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Normalize emails to lowercase
      const normalizedInput = {
        ...input,
        emails: input.emails.map((email) => email.toLowerCase().trim()),
      };

      const client = await ctx.db.client.create({
        data: normalizedInput,
      });

      return client;
    }),

  // Update client
  update: adminProcedure
    .input(updateClientSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const existingClient = await ctx.db.client.findUnique({
        where: { id },
      });

      if (!existingClient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Client not found",
        });
      }

      // Normalize emails to lowercase if emails are being updated
      const normalizedData = {
        ...data,
        ...(data.emails && {
          emails: data.emails.map((email) => email.toLowerCase().trim()),
        }),
      };

      const client = await ctx.db.client.update({
        where: { id },
        data: normalizedData,
      });

      return client;
    }),

  // Delete client
  delete: adminProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const existingClient = await ctx.db.client.findUnique({
        where: { id: input.id },
        include: { tickets: true },
      });

      if (!existingClient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Client not found",
        });
      }

      if (existingClient.tickets.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete client with associated tickets",
        });
      }

      await ctx.db.client.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  // Upload clients from Excel
  uploadFromExcel: adminProcedure
    .input(
      z.object({
        fileContent: z.string(), // Base64 encoded file content
        fileName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Validate file extension
        const fileExtension = input.fileName.toLowerCase().split(".").pop();
        if (!["xlsx", "xls"].includes(fileExtension || "")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Only Excel files (.xlsx, .xls) are supported. CSV files are not allowed.",
          });
        }

        // Decode base64 content
        const buffer = Buffer.from(input.fileContent, "base64");

        // Parse Excel file
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length < 2) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Excel file must have at least a header row and one data row",
          });
        }

        const headers = jsonData[0] as string[];
        const dataRows = jsonData.slice(1) as (string | number | null)[][];

        // Validate headers
        const requiredHeaders = ["name", "emails"];
        const missingHeaders = requiredHeaders.filter(
          (header) =>
            !headers.some((h) => h.toLowerCase().includes(header.toLowerCase()))
        );

        if (missingHeaders.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Missing required headers: ${missingHeaders.join(", ")}`,
          });
        }

        const results = {
          success: 0,
          errors: [] as string[],
        };

        // Process each row
        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i];
          try {
            const clientData: {
              name?: string;
              emails?: string[];
              phone?: string[];
              address?: string;
              city?: string;
              state?: string;
              country?: string;
              companyName?: string;
              isActive?: boolean;
            } = {};

            headers.forEach((header, index) => {
              const value = row[index];
              const headerLower = header.toLowerCase();

              if (
                headerLower.includes("name") &&
                !headerLower.includes("company")
              ) {
                clientData.name = value?.toString() || "";
              } else if (headerLower.includes("email")) {
                const emails =
                  value
                    ?.toString()
                    .split(/[,;]/)
                    .map((e: string) => e.trim().toLowerCase())
                    .filter(Boolean) || [];
                clientData.emails = emails;
              } else if (headerLower.includes("phone")) {
                // Improved phone number processing - only use comma as separator
                const phones =
                  value
                    ?.toString()
                    .split(",")
                    .map((p: string) => p.trim())
                    .filter(Boolean) || [];
                clientData.phone = phones;
              } else if (headerLower.includes("address")) {
                clientData.address = value?.toString() || "";
              } else if (headerLower.includes("city")) {
                clientData.city = value?.toString() || "";
              } else if (headerLower.includes("state")) {
                clientData.state = value?.toString() || "";
              } else if (headerLower.includes("country")) {
                clientData.country = value?.toString() || "";
              } else if (headerLower.includes("company")) {
                clientData.companyName = value?.toString() || "";
              } else if (
                headerLower.includes("active") ||
                headerLower.includes("isactive")
              ) {
                // Handle isActive field - can be boolean, string, or number
                if (typeof value === "boolean") {
                  clientData.isActive = value;
                } else if (typeof value === "string") {
                  const lowerValue = value.toLowerCase().trim();
                  clientData.isActive =
                    lowerValue === "true" ||
                    lowerValue === "yes" ||
                    lowerValue === "1" ||
                    lowerValue === "active";
                } else if (typeof value === "number") {
                  clientData.isActive = value === 1;
                } else {
                  clientData.isActive = true; // Default to true if not specified
                }
              }
            });

            // Validate required fields
            if (
              !clientData.name ||
              !clientData.emails ||
              clientData.emails.length === 0
            ) {
              throw new Error("Name and emails are required");
            }

            // Validate email format
            const invalidEmails = clientData.emails.filter((email: string) => {
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              return !emailRegex.test(email);
            });

            if (invalidEmails.length > 0) {
              throw new Error(
                `Invalid email format: ${invalidEmails.join(", ")}`
              );
            }

            // Create client
            await ctx.db.client.create({
              data: {
                name: clientData.name!,
                emails: clientData.emails!,
                phone: clientData.phone || [],
                address: clientData.address || null,
                city: clientData.city || null,
                state: clientData.state || null,
                country: clientData.country || null,
                companyName: clientData.companyName || null,
                isActive: clientData.isActive ?? true,
              },
            });

            results.success++;
          } catch (error) {
            results.errors.push(
              `Row ${i + 2}: ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
          }
        }

        return results;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to process Excel file",
        });
      }
    }),

  // Get client statistics
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [totalClients, clientsWithTickets, clientsWithoutTickets] =
      await Promise.all([
        ctx.db.client.count(),
        ctx.db.client.count({
          where: {
            tickets: {
              some: {},
            },
          },
        }),
        ctx.db.client.count({
          where: {
            tickets: {
              none: {},
            },
          },
        }),
      ]);

    return {
      totalClients,
      clientsWithTickets,
      clientsWithoutTickets,
    };
  }),
});
