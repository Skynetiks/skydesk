# Email Ticketing System

A modern email-based ticketing system built with Next.js, tRPC, and Prisma. This system allows you to receive support emails and convert them into tickets that can be managed through a web interface.

## Features

- **Email Integration**: Receive emails via webhook and convert them to tickets
- **Email Threading**: Automatic threading of email conversations
- **Ticket Confirmation Emails**: Automatic confirmation emails sent to ticket creators
- **Ticket ID Embedding**: Ticket IDs embedded in email bodies for proper threading
- **Rich Text Editor**: WYSIWYG editor for composing replies
- **User Management**: Admin and user roles with different permissions
- **Ticket Assignment**: Assign tickets to specific agents
- **Status Tracking**: Track ticket status (Open, In Progress, Resolved, Closed)
- **Priority Levels**: Set ticket priority (Low, Medium, High, Urgent)
- **File Attachments**: Support for email attachments
- **Email Notifications**: Automatic email notifications for all parties

## Email Notifications

The system automatically sends email notifications to keep all parties informed about ticket updates:

### Notification Types

1. **Ticket Confirmation Notifications**: When a new ticket is created, the ticket creator receives a confirmation email with ticket details and instructions
2. **Agent Reply Notifications**: When an agent replies to a ticket, the ticket creator receives an email with the reply
3. **User Reply Notifications**: When a user replies to an assigned ticket, the assigned agent receives a notification email
4. **Assignment Notifications**: When a ticket is assigned to an agent, they receive a notification email with ticket details

### Notification Features

- **Automatic Sending**: Notifications are sent automatically when relevant actions occur
- **Error Handling**: Failed email sends are logged but don't interrupt the main workflow
- **Threading Support**: All emails maintain proper email threading for email clients
- **Rich Formatting**: HTML notifications include styled layouts and direct action buttons
- **Ticket Links**: All notifications include direct links to view the ticket in the system
- **Ticket ID Embedding**: Ticket IDs are embedded in email bodies for proper threading

### Testing Notifications

Use the provided test scripts to verify email notification functionality:

```bash
# Test ticket confirmation emails
node test-ticket-confirmation.js

# Test user reply notifications
node test-email-notifications.js

# Test email threading
node test-email-threading.js
```

These will:
1. Create new tickets and verify confirmation emails are sent
2. Simulate user replies and verify threading works
3. Test ticket ID detection in email bodies
4. Verify that notifications are sent to assigned agents

## Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Email server (SMTP) for sending notifications

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd email-ticketing-app
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Configure your environment variables:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/ticketing_db"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
```

5. Set up the database:
```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

6. Start the development server:
```bash
npm run dev
```

### Email Configuration

1. Access the admin interface at `/admin/config`
2. Configure your email settings:

   **SMTP Settings (Required for sending emails):**
   - **EMAIL_HOST**: Your SMTP server hostname (e.g., smtp.gmail.com)
   - **EMAIL_PORT**: SMTP port (usually 587 for TLS, 465 for SSL)
   - **EMAIL_USER**: Your email username
   - **EMAIL_PASS**: Your email password or app password
   - **SUPPORT_EMAIL**: The email address that will send notifications

   **IMAP Settings (Optional for receiving emails):**
   - **IMAP_HOST**: Your IMAP server hostname (e.g., imap.gmail.com)
   - **IMAP_PORT**: IMAP port (usually 993 for SSL, 143 for non-SSL)
   - **IMAP_USER**: Your email username
   - **IMAP_PASS**: Your email password or app password
   - **IMAP_SECURE**: Use SSL/TLS connection (true/false)
   - **INITIAL_EMAIL_LIMIT**: Number of emails to process on first setup

3. Test both connections using the "Test Connection" buttons
4. Save your configurations

**Note:** SMTP is required for sending notification emails. IMAP is optional and only used for receiving emails (webhook is recommended for production).

### Webhook Setup

Configure your email service to send webhooks to:
```
POST http://your-domain.com/api/webhook/email
```

The webhook should include:
- `from`: Sender email address
- `subject`: Email subject
- `text`: Email body (plain text)
- `html`: Email body (HTML, optional)
- `attachments`: Array of attachments (optional)
- `headers`: Email headers for threading (optional)

## Usage

### For Users

1. **View Tickets**: Navigate to the tickets page to see all tickets
2. **Reply to Tickets**: Click on a ticket to view the conversation and reply
3. **Rich Text Editor**: Use the WYSIWYG editor to format your responses

### For Admins

1. **User Management**: Manage users and their roles at `/admin/users`
2. **Ticket Assignment**: Assign tickets to specific agents
3. **System Configuration**: Configure email settings at `/admin/config`
4. **Ticket Management**: Update ticket status, priority, and other details

## API Endpoints

- `POST /api/webhook/email` - Receives emails and creates/updates tickets
- `POST /api/trpc/ticket.reply` - Sends agent replies to users
- `POST /api/trpc/ticket.assign` - Assigns tickets to agents
- `GET /api/trpc/ticket.getAll` - Retrieves all tickets
- `GET /api/trpc/ticket.getById` - Retrieves a specific ticket

## Testing

The project includes several test scripts:

```bash
# Test email threading
node test-email-threading.js

# Test email notifications
node test-email-notifications.js

# Test assignment notifications
node test-assignment-notification.js

# Test SMTP configuration
node test-smtp-configuration.js

# Test webhook functionality
node test-webhook.js
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
