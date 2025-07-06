import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const hashedPassword = await bcrypt.hash("admin123", 12);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@company.com" },
    update: {},
    create: {
      email: "admin@company.com",
      name: "Admin User",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  // Create regular user
  const userPassword = await bcrypt.hash("user123", 12);

  const regularUser = await prisma.user.upsert({
    where: { email: "user@company.com" },
    update: {},
    create: {
      email: "user@company.com",
      name: "Support User",
      password: userPassword,
      role: "USER",
    },
  });

  // Create system user for automated operations
  const systemUser = await prisma.user.upsert({
    where: { email: "system@company.com" },
    update: {},
    create: {
      email: "system@company.com",
      name: "System",
      password: "hashed_password_here",
      role: "ADMIN",
    },
  });

  // Create initial configurations
  const configurations = [
    // SMTP Configuration (for sending emails)
    {
      key: "EMAIL_HOST",
      value: "smtp.gmail.com",
      description: "SMTP server hostname (e.g., smtp.gmail.com)",
    },
    {
      key: "EMAIL_PORT",
      value: "587",
      description: "SMTP server port (usually 587 for TLS, 465 for SSL)",
    },
    {
      key: "EMAIL_USER",
      value: "your-email@gmail.com",
      description: "Email address or username for SMTP authentication",
    },
    {
      key: "EMAIL_PASS",
      value: "your-app-password",
      description: "Password or app password for SMTP authentication",
    },
    {
      key: "SENDER_EMAIL",
      value: "support@company.com",
      description:
        "From email address for sending notifications (falls back to EMAIL_USER if not set)",
    },
    // IMAP Configuration (for receiving emails - optional)
    {
      key: "IMAP_HOST",
      value: "imap.gmail.com",
      description: "IMAP server hostname (e.g., imap.gmail.com)",
    },
    {
      key: "IMAP_PORT",
      value: "993",
      description: "IMAP server port (usually 993 for SSL, 143 for non-SSL)",
    },
    {
      key: "IMAP_USER",
      value: "your-email@gmail.com",
      description: "Email address or username for IMAP authentication",
    },
    {
      key: "IMAP_PASS",
      value: "your-app-password",
      description: "Password or app password for IMAP authentication",
    },
    {
      key: "IMAP_SECURE",
      value: "true",
      description: "Use SSL/TLS connection (true/false)",
    },
    {
      key: "INITIAL_EMAIL_LIMIT",
      value: "10",
      description: "Number of emails to process on first setup",
    },
  ];

  for (const config of configurations) {
    await prisma.configuration.upsert({
      where: { key: config.key },
      update: {},
      create: {
        ...config,
        updatedBy: adminUser.id,
      },
    });
  }

  console.log("Database seeded successfully!");
  console.log("Admin user: admin@company.com / admin123");
  console.log("Regular user: user@company.com / user123");
  console.log("Initial configurations created");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
