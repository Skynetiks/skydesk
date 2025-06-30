# Ticket Features

## Email Threading and Reply Detection

The ticket system now supports advanced email threading and reply detection features:

### Features

1. **Email Threading**: Messages are automatically grouped into threads based on email headers
2. **Reply Detection**: The system detects when an email is a reply to a previous message
3. **WYSIWYG Editor**: Rich text editor for composing replies with formatting options
4. **Ticket Confirmation Emails**: Automatic confirmation emails sent to ticket creators
5. **Ticket ID Embedding**: Ticket IDs are embedded in email bodies for proper threading

### Email Headers Used for Threading

- **Message-ID**: Unique identifier for each email
- **In-Reply-To**: References the Message-ID of the email being replied to
- **References**: Chain of Message-IDs showing the conversation history

### Ticket Confirmation Emails

When a new ticket is created, the system automatically sends a confirmation email to the ticket creator with:

- **Subject**: "Ticket Received: [Original Subject]"
- **Ticket Details**: Complete ticket information including ticket ID
- **Original Message**: The user's original message content
- **Instructions**: Clear guidance on how to reply to the email thread
- **Ticket ID**: Embedded in the email body for proper threading
- **Threading Headers**: Proper Message-ID, In-Reply-To, and References headers

### Ticket ID Detection

The system can detect ticket IDs in multiple ways:

1. **Email Headers**: Using In-Reply-To and References headers
2. **Embedded Ticket ID**: Looking for ticket IDs in email body text
3. **Confirmation Message ID**: Detecting confirmation email message IDs
4. **Pattern Matching**: Recognizing various ticket ID formats

#### Supported Ticket ID Patterns

- `Ticket ID: [ID]`
- `ticket #[ID]`
- `case #[ID]`
- `[ID]` (bracketed format)
- Confirmation message IDs: `ticket-confirmation-[ID]@domain.com`

### How It Works

1. **New Ticket Creation**: When a new ticket is created, a confirmation email is sent
2. **Email Threading**: Messages with related Message-ID, In-Reply-To, or References are grouped together
3. **Ticket ID Detection**: The system searches for embedded ticket IDs in email bodies
4. **Visual Indicators**: Reply messages are visually distinguished with icons and styling
5. **Chronological Order**: Messages within threads are displayed in chronological order

### WYSIWYG Editor Features

The rich text editor includes:

- **Text Formatting**: Bold, italic, headings
- **Lists**: Bullet points and numbered lists
- **Blockquotes**: For quoting previous messages
- **Links**: Add and edit hyperlinks
- **Images**: Insert images via URL
- **Undo/Redo**: Full editing history

### Usage

1. **Viewing Tickets**: Navigate to a ticket to see the email thread
2. **Replying**: Click the "Reply" button to open the WYSIWYG editor
3. **Composing**: Use the toolbar to format your response
4. **Sending**: Click "Send Reply" to send the formatted email

## Email Notifications

The system automatically sends email notifications to keep all parties informed about ticket updates:

### Notification Types

1. **Ticket Confirmation Notifications**: When a new ticket is created, the ticket creator receives a confirmation email
2. **Agent Reply Notifications**: When an agent replies to a ticket, the ticket creator receives an email
3. **User Reply Notifications**: When a user replies to an assigned ticket, the assigned agent receives a notification email
4. **Assignment Notifications**: When a ticket is assigned to an agent, they receive a notification email

### Notification Content

#### Ticket Confirmation Notifications (to ticket creator)
- **Subject**: `Ticket Received: [Original Subject]`
- **Content**: 
  - Confirmation message
  - Complete ticket details (ID, subject, status, priority)
  - Original message content
  - Instructions for replying to the email thread
  - Embedded ticket ID for proper threading
- **Headers**: Proper threading headers (Message-ID, In-Reply-To, References)
- **Format**: Both plain text and HTML versions with styled layout

#### Agent Reply Notifications (to ticket creator)
- **Subject**: `Re: [Original Ticket Subject]`
- **Content**: The agent's reply message with embedded ticket ID
- **Headers**: Proper threading headers (Message-ID, In-Reply-To, References)
- **Format**: Both plain text and HTML versions

#### User Reply Notifications (to assigned agent)
- **Subject**: `New Reply: [Ticket Subject]`
- **Content**: 
  - Ticket details (subject, priority, status)
  - User's reply message
  - Direct link to view the ticket
- **Format**: Both plain text and HTML versions with styled layout

#### Assignment Notifications (to newly assigned agent)
- **Subject**: `Ticket Assigned: [Ticket Subject]`
- **Content**:
  - Complete ticket details
  - Latest message from the user (if any)
  - Priority and status information
  - Direct link to view the ticket
- **Format**: Both plain text and HTML versions with styled layout

### Notification Features

- **Automatic Sending**: Notifications are sent automatically when relevant actions occur
- **Error Handling**: Failed email sends are logged but don't interrupt the main workflow
- **Threading Support**: All emails maintain proper email threading for email clients
- **Rich Formatting**: HTML notifications include styled layouts and direct action buttons
- **Ticket Links**: All notifications include direct links to view the ticket in the system
- **Ticket ID Embedding**: Ticket IDs are embedded in email bodies for proper threading

### Configuration

The system automatically:
- Sends confirmation emails when new tickets are created
- Extracts threading headers from incoming emails
- Generates proper Message-ID, In-Reply-To, and References for replies
- Groups related messages into visual threads
- Maintains conversation history
- Sends appropriate notifications to all parties
- Embeds ticket IDs in email bodies for proper threading

### Email Configuration

The system requires both SMTP and IMAP configuration:

**SMTP Configuration (Required for sending emails):**
- `EMAIL_HOST` - SMTP server hostname (e.g., smtp.gmail.com)
- `EMAIL_PORT` - SMTP port (587 for TLS, 465 for SSL)
- `EMAIL_USER` - Email username
- `EMAIL_PASS` - Email password or app password
- `SUPPORT_EMAIL` - From address for notifications

**IMAP Configuration (Optional for receiving emails):**
- `IMAP_HOST` - IMAP server hostname (e.g., imap.gmail.com)
- `IMAP_PORT` - IMAP port (993 for SSL, 143 for non-SSL)
- `IMAP_USER` - Email username
- `IMAP_PASS` - Email password or app password
- `IMAP_SECURE` - Use SSL/TLS connection (true/false)
- `INITIAL_EMAIL_LIMIT` - Number of emails to process on first setup

**Configuration Steps:**
1. Access `/admin/config` as an admin user
2. Configure SMTP settings (required for sending emails)
3. Optionally configure IMAP settings (for receiving emails)
4. Test both connections using the test buttons
5. Save your configurations

**Note:** SMTP is required for sending notification emails. IMAP is optional and only used for receiving emails (webhook is recommended for production).

### Testing

Use the test scripts to verify email notification functionality:

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

### Technical Implementation

#### Database Schema

```sql
-- Message table with threading fields
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  isFromUser BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT now(),
  messageId TEXT,           -- Email Message-ID
  inReplyTo TEXT,           -- In-Reply-To header
  references TEXT,          -- References header
  ticketId TEXT NOT NULL,
  userId TEXT,
  FOREIGN KEY (ticketId) REFERENCES tickets(id),
  FOREIGN KEY (userId) REFERENCES users(id)
);
```

#### API Endpoints

- `POST /api/webhook/email` - Receives emails with threading headers and sends notifications
- `POST /api/trpc/ticket.create` - Creates tickets and sends confirmation emails
- `POST /api/trpc/ticket.reply` - Sends replies with proper threading and ticket ID embedding
- `POST /api/trpc/ticket.assign` - Assigns tickets and sends assignment notifications

#### Components

- `EmailThread` - Displays threaded email conversations
- `RichTextEditor` - WYSIWYG editor for composing replies
- `TicketDetail` - Main ticket view with threading support

### Testing

Use the test script to verify ticket confirmation emails:

```bash
node test-ticket-confirmation.js
```

This will:
1. Create a new ticket
2. Verify confirmation email is sent
3. Simulate replies to the confirmation email
4. Test ticket ID detection in email bodies
5. Verify proper email threading

No additional configuration is required for basic threading functionality. 