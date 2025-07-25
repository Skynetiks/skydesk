import { db } from "@/server/db";

export interface TicketAssignmentConfig {
  mode: "round_robin" | "default_user";
  defaultUserId?: string;
}

/**
 * Get ticket assignment configuration from database
 */
export async function getTicketAssignmentConfig(): Promise<TicketAssignmentConfig> {
  const configs = await db.configuration.findMany({
    where: {
      key: {
        in: ["TICKET_ASSIGNMENT_MODE", "DEFAULT_TICKET_ASSIGNEE"],
      },
    },
  });

  const configMap = configs.reduce((acc, config) => {
    acc[config.key] = config.value;
    return acc;
  }, {} as Record<string, string>);

  return {
    mode:
      (configMap.TICKET_ASSIGNMENT_MODE as "round_robin" | "default_user") ||
      "round_robin",
    defaultUserId: configMap.DEFAULT_TICKET_ASSIGNEE || undefined,
  };
}

/**
 * Get the next user to assign a ticket to based on configuration
 */
export async function getNextTicketAssignee(): Promise<string | null> {
  const config = await getTicketAssignmentConfig();
  console.log("Ticket assignment config:", config);

  if (config.mode === "default_user") {
    console.log("Using default user assignment mode");
    // Return the configured default user, or null if not set
    if (config.defaultUserId) {
      // Verify the user still exists
      const user = await db.user.findUnique({
        where: { id: config.defaultUserId },
        select: { id: true, name: true, email: true },
      });
      if (user) {
        console.log(`Default user found: ${user.name} (${user.email})`);
        return user.id;
      } else {
        console.log(`Default user ${config.defaultUserId} not found`);
        return null;
      }
    }
    console.log("No default user configured");
    return null;
  }

  // Round robin mode
  if (config.mode === "round_robin") {
    console.log("Using round robin assignment mode");
    // Get all users (excluding system user)
    const users = await db.user.findMany({
      where: {
        email: { not: "system@company.com" },
      },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: {
            assignedTickets: {
              where: {
                status: { in: ["OPEN", "IN_PROGRESS"] },
              },
            },
          },
        },
      },
      orderBy: {
        assignedTickets: {
          _count: "asc",
        },
      },
    });

    console.log(`Found ${users.length} users for round robin assignment`);
    users.forEach((user) => {
      console.log(
        `- ${user.name} (${user.email}): ${user._count.assignedTickets} active tickets`
      );
    });

    if (users.length === 0) {
      console.log("No users available for assignment");
      return null;
    }

    // Return the user with the least number of active tickets
    const selectedUser = users[0];
    console.log(
      `Selected user for assignment: ${selectedUser.name} (${selectedUser.email})`
    );
    return selectedUser.id;
  }

  console.log("Unknown assignment mode:", config.mode);
  return null;
}

/**
 * Assign a ticket to a user based on the current configuration
 */
export async function assignTicketToUser(
  ticketId: string
): Promise<string | null> {
  const assigneeId = await getNextTicketAssignee();

  if (assigneeId) {
    await db.ticket.update({
      where: { id: ticketId },
      data: {
        assignedToId: assigneeId,
        status: "IN_PROGRESS",
      },
    });
  }

  return assigneeId;
}
