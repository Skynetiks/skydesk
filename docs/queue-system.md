# Queue-Based Email Campaign System

## Overview

The email campaign system has been converted from an immediate execution model to a queue-based system that works efficiently with cron jobs running at minute intervals.

## Problem Solved

**Previous Issue**: The system used `setTimeout` with second-based delays, but cron jobs typically run at minute intervals (1-5 minutes), creating a fundamental mismatch.

**Solution**: Implemented a two-phase queue system:
1. **Queue Phase**: Mark emails as `QUEUED` when campaign is executed
2. **Processing Phase**: Process queued emails in batches during each cron run

## How It Works

### 1. Campaign Execution (Queue Phase)
When a campaign is executed:
- Recipients with `PENDING` status are marked as `QUEUED`
- Campaign execution completes immediately
- No emails are sent during this phase

### 2. Queue Processing (Sending Phase)
A separate cron job processes the queue:
- Finds all campaigns with `QUEUED` recipients
- Processes emails in batches based on campaign concurrency settings
- Sends emails and updates status to `SENT` or `FAILED`
- Marks campaign as `COMPLETED` when all emails are processed

## Database Changes

### New Status
- Added `QUEUED` status to `RecipientStatus` enum
- Recipients can now be: `PENDING` → `QUEUED` → `SENT`/`FAILED`

### Migration
```sql
-- Migration: add_queued_status_to_recipients
ALTER TYPE "RecipientStatus" ADD VALUE 'QUEUED';
```

## API Endpoints

### Campaign Execution
- **POST** `/api/trpc/campaign.execute`
  - Marks pending recipients as `QUEUED`
  - Returns immediately without sending emails
  - Response: `{ queued: number, message: string }`

### Queue Processing
- **POST** `/api/cron/process-email-queue`
  - Processes queued emails in batches
  - Designed for cron job execution
  - Response: `{ processed: number, sent: number, failed: number }`

## Cron Job Setup

### Recommended Configuration
```bash
# Process email queue every 2 minutes
*/2 * * * * curl -X POST https://your-domain.com/api/cron/process-email-queue \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

### Environment Variables
```env
# Required for cron job authentication
CRON_SECRET=your-secure-cron-secret

# Email configuration (required for sending)
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
SUPPORT_EMAIL=support@yourcompany.com
```

## Benefits

### 1. Cron-Friendly
- No sub-minute delays
- Processes emails in batches during each cron run
- Respects minute-based scheduling

### 2. Better Performance
- Campaign execution doesn't block while sending emails
- Immediate feedback to users
- Non-blocking operation

### 3. Enhanced Monitoring
- Clear separation between queuing and sending phases
- Better visibility into email processing status
- Detailed logging and error tracking

### 4. Improved Control
- Can pause/resume queue processing
- Better error handling and retry mechanisms
- Scalable architecture

### 5. Resource Management
- Prevents overwhelming email servers
- Configurable batch sizes per cron run
- Respects campaign concurrency settings

## Configuration Options

### Campaign Settings
- **Concurrency**: Number of emails sent simultaneously (default: 5)
- **Delay**: Time between batches (now handled by cron interval)
- **Status**: Campaign lifecycle management

### Queue Processing
- **Batch Size**: Maximum emails processed per cron run (capped at 50)
- **Processing Order**: Oldest queued emails processed first
- **Error Handling**: Failed emails marked with error messages

## Monitoring

### Campaign Statistics
- **Total**: All recipients
- **Sent**: Successfully delivered emails
- **Queued**: Emails waiting to be sent
- **Pending**: Emails not yet queued
- **Failed**: Failed deliveries with error details
- **Bounced**: Bounced emails

### Queue Status
- Real-time queue processing status
- Execution history with timestamps
- Success/failure rates
- Error tracking and reporting

## Usage Workflow

### 1. Create Campaign
1. Go to Campaigns section
2. Create new campaign with recipients
3. Campaign starts in `DRAFT` status

### 2. Execute Campaign
1. Set campaign status to `ACTIVE`
2. Click "Send Now" to queue emails
3. Recipients are marked as `QUEUED`
4. Campaign execution completes immediately

### 3. Monitor Progress
1. View campaign statistics showing queued vs sent counts
2. Monitor queue processing through execution logs
3. Track success rates and failure reasons

### 4. Queue Processing
1. Cron job automatically processes queued emails
2. Emails are sent in batches based on concurrency settings
3. Status updates to `SENT` or `FAILED`
4. Campaign marked as `COMPLETED` when finished

## Error Handling

### Queue Processing Errors
- Failed emails are marked with error messages
- Processing continues with remaining emails
- Detailed error logging for debugging

### Campaign Execution Errors
- Execution record marked as `FAILED`
- Error messages stored for reference
- Campaign status remains unchanged

### Retry Mechanism
- Failed emails can be manually retried
- Queue processing handles transient errors
- Persistent failures are logged for review

## Best Practices

### 1. Cron Job Frequency
- **Recommended**: Every 2-5 minutes
- **Too Frequent**: May overwhelm email servers
- **Too Infrequent**: Delays email delivery

### 2. Batch Sizes
- **Default**: Campaign concurrency setting
- **Maximum**: 50 emails per cron run
- **Adjustment**: Based on email server capacity

### 3. Monitoring
- Monitor queue processing logs
- Track success rates and failure patterns
- Review error messages for configuration issues

### 4. Scaling
- Multiple cron jobs can process different campaigns
- Queue processing is idempotent and safe
- System can handle multiple concurrent campaigns

## Troubleshooting

### Common Issues

#### 1. Emails Not Sending
- Check cron job is running
- Verify email configuration
- Review queue processing logs

#### 2. High Failure Rate
- Check email server settings
- Review recipient email addresses
- Monitor email provider limits

#### 3. Slow Processing
- Adjust cron job frequency
- Review batch size settings
- Check email server performance

### Debug Commands
```bash
# Check cron job execution
curl -X POST https://your-domain.com/api/cron/process-email-queue \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# View response for debugging
echo $?  # Check exit code
```

## Migration Notes

### From Previous System
- Existing campaigns continue to work
- New `QUEUED` status added to database
- Backward compatible with existing data

### Database Migration
```bash
# Apply the new migration
npx prisma migrate dev --name add_queued_status_to_recipients
```

### Configuration Updates
- Update cron job to use new endpoint
- Verify environment variables
- Test queue processing functionality 