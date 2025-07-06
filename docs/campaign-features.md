# Email Campaign Features

The email ticketing system now includes a comprehensive email campaign management feature that allows users to create, schedule, and execute email campaigns to reach their clients.

## Overview

The campaign system provides:
- **Campaign Creation**: Create email campaigns with rich content and scheduling
- **Recipient Management**: Select clients and additional email addresses
- **Scheduling**: Set up automated execution schedules (once, daily, weekly, monthly)
- **Execution Control**: Control how many emails are sent per execution
- **Tracking**: Monitor campaign performance and delivery status
- **Automation**: Automatic execution via cron jobs

## Features

### 1. Campaign Management

#### Campaign Creation
- **Name**: Descriptive name for the campaign
- **Subject**: Email subject line
- **Body**: Rich text email content with formatting
- **Emails per Execution**: Control batch size (1-1000 emails per execution)
- **Status**: Draft, Active, Paused, Completed, Cancelled

#### Scheduling Options
- **Once**: Send immediately or at a specific date/time
- **Daily**: Send every N days at a specific time
- **Weekly**: Send every N weeks on specific days of the week
- **Monthly**: Send every N months on a specific day of the month

#### Recipient Selection
- **Client Selection**: Choose from existing clients in the database
- **Additional Emails**: Add individual email addresses
- **Automatic Deduplication**: Prevents duplicate recipients

### 2. Email Execution

#### Single Campaign Execution Limit
- **One Campaign at a Time**: Only one campaign can be executed simultaneously
- **Execution Prevention**: System prevents starting new campaigns when another is running
- **Visual Indicators**: Clear UI indicators show which campaign is currently running
- **Error Handling**: Graceful error messages when attempting to start multiple campaigns

#### Manual Execution
- Execute campaigns immediately from the campaign detail page
- Control the number of emails sent in each execution
- Real-time feedback on execution status
- Automatic prevention of concurrent executions

#### Automated Execution
- Cron job automatically executes campaigns based on their schedules
- Configurable execution limits to prevent overwhelming email servers
- Error handling and retry logic
- Respects single campaign execution limit

#### Email Template Integration
- Uses the same email template system as ticket notifications
- Includes company branding (logo, colors, contact information)
- Responsive HTML design with plain text fallback

### 3. Tracking and Analytics

#### Recipient Status Tracking
- **Pending**: Recipients waiting to receive the email
- **Sent**: Successfully delivered emails
- **Failed**: Failed deliveries with error messages
- **Bounced**: Emails that bounced back

#### Execution History
- Detailed logs of each campaign execution
- Success/failure counts per execution
- Error messages for failed executions
- Execution timestamps and duration

#### Performance Metrics
- Total recipients count
- Success rate percentage
- Sent vs failed email counts
- Campaign completion status

## Database Schema

### Campaign Model
```sql
model Campaign {
    id                    String         @id @default(cuid())
    name                  String
    subject               String
    body                  String
    status                CampaignStatus @default(DRAFT)
    emailsPerExecution    Int            @default(50)
    totalRecipients       Int            @default(0)
    sentCount             Int            @default(0)
    failedCount           Int            @default(0)
    createdAt             DateTime       @default(now())
    updatedAt             DateTime       @updatedAt
    lastExecuted          DateTime?
    nextExecution         DateTime?
    createdById           String
    createdBy             User           @relation("CreatedCampaigns", fields: [createdById], references: [id])
    
    // Relations
    schedule              CampaignSchedule?
    recipients            CampaignRecipient[]
    executions            CampaignExecution[]
}
```

### Campaign Schedule Model
```sql
model CampaignSchedule {
    id          String            @id @default(cuid())
    frequency   ScheduleFrequency
    interval    Int
    startTime   DateTime
    endTime     DateTime?
    timeOfDay   String            // HH:mm format
    daysOfWeek  Int[]             // For weekly frequency
    dayOfMonth  Int?              // For monthly frequency
    isActive    Boolean           @default(true)
    
    // Relations
    campaignId  String            @unique
    campaign    Campaign          @relation(fields: [campaignId], references: [id], onDelete: Cascade)
}
```

### Campaign Recipient Model
```sql
model CampaignRecipient {
    id            String          @id @default(cuid())
    email         String
    name          String?
    status        RecipientStatus @default(PENDING)
    sentAt        DateTime?
    failedAt      DateTime?
    errorMessage  String?
    createdAt     DateTime        @default(now())
    
    // Relations
    campaignId    String
    campaign      Campaign        @relation(fields: [campaignId], references: [id], onDelete: Cascade)
    clientId      String?
    client        Client?         @relation(fields: [clientId], references: [id], onDelete: SetNull)
}
```

### Campaign Execution Model
```sql
model CampaignExecution {
    id            String          @id @default(cuid())
    executionTime DateTime        @default(now())
    emailsSent    Int             @default(0)
    emailsFailed  Int             @default(0)
    status        ExecutionStatus @default(COMPLETED)
    errorMessage  String?
    
    // Relations
    campaignId    String
    campaign      Campaign        @relation(fields: [campaignId], references: [id], onDelete: Cascade)
}
```

## API Endpoints

### Campaign Management
- `GET /api/trpc/campaign.getAll` - List all campaigns
- `GET /api/trpc/campaign.getById` - Get campaign details
- `POST /api/trpc/campaign.create` - Create new campaign
- `PUT /api/trpc/campaign.update` - Update campaign
- `DELETE /api/trpc/campaign.delete` - Delete campaign

### Campaign Execution
- `POST /api/trpc/campaign.execute` - Execute campaign manually
- `GET /api/trpc/campaign.getReadyForExecution` - Get campaigns ready for execution
- `POST /api/trpc/campaign.calculateNextExecution` - Calculate next execution time

### Analytics
- `GET /api/trpc/campaign.getStats` - Get campaign statistics

### Execution Status
- `GET /api/trpc/campaign.getRunningCampaign` - Check if any campaign is currently running
- `GET /api/trpc/campaign.isCampaignRunning` - Check if a specific campaign is running

### Cron Jobs
- `POST /api/cron/execute-campaigns` - Automated campaign execution

## Setup and Configuration

### 1. Database Migration
The campaign feature requires database migrations to create the necessary tables:

```bash
npx prisma migrate dev --name add_campaign_models
```

### 2. Cron Job Setup
For automated campaign execution, set up a cron job to call the execution endpoint:

```bash
# Example cron job (runs every 5 minutes)
*/5 * * * * curl -X POST https://your-domain.com/api/cron/execute-campaigns \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

### 3. Environment Variables
Ensure the following environment variables are set:

```env
# Email configuration (required for sending campaigns)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
SUPPORT_EMAIL=support@yourcompany.com

# Cron job security
CRON_SECRET=your-secure-cron-secret

# Company branding (optional, for email templates)
COMPANY_NAME=Your Company Name
COMPANY_LOGO=https://your-domain.com/logo.png
COMPANY_WEBSITE=https://your-domain.com
COMPANY_PHONE=+1-555-123-4567
COMPANY_EMAIL=contact@yourcompany.com
COMPANY_ADDRESS=123 Main St, City, State 12345
```

## Usage Guide

### Creating a Campaign

1. **Navigate to Campaigns**: Go to the Campaigns section in the admin panel
2. **Create New Campaign**: Click "Create Campaign" button
3. **Fill Basic Information**:
   - Campaign name
   - Email subject
   - Email body (using rich text editor)
   - Emails per execution limit
4. **Set Schedule**:
   - Choose frequency (Once, Daily, Weekly, Monthly)
   - Set interval and time of day
   - Configure specific days for weekly/monthly schedules
5. **Select Recipients**:
   - Choose clients from the database
   - Add additional email addresses
6. **Save Campaign**: Campaign starts in "Draft" status

### Managing Campaigns

#### Campaign Statuses
- **Draft**: Campaign is created but not active
- **Active**: Campaign is running and will execute according to schedule
- **Paused**: Campaign is temporarily stopped
- **Completed**: All recipients have been processed
- **Cancelled**: Campaign has been cancelled

#### Manual Execution
1. Go to campaign detail page
2. Set the number of emails to send
3. Click "Send Now" to execute immediately
4. Monitor execution progress and results

#### Monitoring Performance
- View real-time statistics on the campaign overview
- Check recipient status in the Recipients tab
- Review execution history in the Executions tab
- Monitor success rates and failure reasons

### Best Practices

#### Email Content
- Use clear, compelling subject lines
- Keep content concise and relevant
- Include clear call-to-action buttons
- Test emails before sending to large lists
- Use the rich text editor for formatting

#### Scheduling
- Consider recipient time zones when setting execution times
- Start with smaller batches to test delivery rates
- Use appropriate intervals to avoid overwhelming recipients
- Set end dates for recurring campaigns

#### Recipient Management
- Regularly clean your client database
- Remove bounced email addresses
- Segment recipients for targeted campaigns
- Respect unsubscribe requests

#### Performance Monitoring
- Monitor delivery rates and bounce rates
- Track open rates and click-through rates (if available)
- Adjust sending frequency based on performance
- Review error messages for failed deliveries

## Docker Deployment

For self-deployment on Linux servers, the campaign system is fully compatible with Docker:

### Docker Compose Example
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:password@db:5432/email_ticketing
      - EMAIL_HOST=smtp.gmail.com
      - EMAIL_PORT=587
      - EMAIL_USER=your-email@gmail.com
      - EMAIL_PASS=your-app-password
      - CRON_SECRET=your-secure-cron-secret
    depends_on:
      - db
    volumes:
      - ./uploads:/app/public/uploads

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=email_ticketing
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Cron Job in Docker
For automated campaign execution in Docker, you can use a separate cron container:

```yaml
  cron:
    image: curlimages/curl:latest
    command: |
      sh -c "
      while true; do
        curl -X POST http://app:3000/api/cron/execute-campaigns \
          -H 'Authorization: Bearer YOUR_CRON_SECRET' \
          -H 'Content-Type: application/json'
        sleep 300
      done
      "
    depends_on:
      - app
```

## Troubleshooting

### Common Issues

#### Campaigns Not Executing
- Check if the cron job is running
- Verify the CRON_SECRET environment variable
- Check campaign status (must be "Active")
- Ensure there are pending recipients
- Review execution logs for errors

#### Email Delivery Failures
- Verify SMTP configuration
- Check email provider sending limits
- Review bounce reports
- Ensure recipient email addresses are valid
- Check for spam filter issues

#### Performance Issues
- Reduce emails per execution
- Increase intervals between executions
- Monitor database performance
- Check email provider rate limits

### Logs and Monitoring
- Check application logs for execution errors
- Monitor database performance during large campaigns
- Review email provider delivery reports
- Track campaign execution times and success rates

## Security Considerations

### Access Control
- Only admin users can create and manage campaigns
- Campaign execution requires proper authentication
- Cron job endpoints are protected with secret tokens

### Data Protection
- Recipient email addresses are stored securely
- Campaign content is encrypted in transit
- Execution logs are retained for audit purposes

### Rate Limiting
- Configurable emails per execution limit
- Automatic throttling to prevent email provider limits
- Graceful handling of delivery failures

## Future Enhancements

### Planned Features
- **A/B Testing**: Test different subject lines and content
- **Segmentation**: Advanced recipient filtering and grouping
- **Analytics Dashboard**: Enhanced reporting and visualization
- **Template Library**: Pre-built email templates
- **Unsubscribe Management**: Automatic unsubscribe handling
- **Delivery Optimization**: Smart sending time optimization

### Integration Possibilities
- **CRM Integration**: Connect with external CRM systems
- **Marketing Automation**: Advanced workflow automation
- **Analytics Integration**: Connect with email analytics services
- **API Extensions**: REST API for external campaign management

## Support

For technical support or feature requests:
- Check the application logs for error details
- Review the database for campaign execution records
- Test email configuration with the built-in test functions
- Contact the development team for advanced troubleshooting

The campaign system is designed to be robust, scalable, and user-friendly, providing comprehensive email marketing capabilities within the existing ticketing system infrastructure. 