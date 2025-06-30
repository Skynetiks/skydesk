# IMAP Configuration Setup

This guide explains how to configure IMAP settings for the email ticketing system.

## Overview

The system uses IMAP to fetch emails from your email server and automatically create tickets from incoming emails. This is different from SMTP (which is used for sending emails).

## Required IMAP Settings

### 1. IMAP_HOST
- **Description**: IMAP server hostname
- **Examples**: 
  - Gmail: `imap.gmail.com`
  - Outlook: `outlook.office365.com`
  - Yahoo: `imap.mail.yahoo.com`
  - Custom server: `mail.yourdomain.com`

### 2. IMAP_PORT
- **Description**: IMAP server port
- **Common values**:
  - SSL/TLS: `993` (recommended)
  - Non-SSL: `143`
- **Default**: `993`

### 3. IMAP_USER
- **Description**: Email address or username for authentication
- **Example**: `support@yourcompany.com`

### 4. IMAP_PASS
- **Description**: Password or app password
- **Important**: For Gmail, you need to use an App Password, not your regular password
- **Example**: `your-app-password-here`

### 5. IMAP_SECURE
- **Description**: Whether to use SSL/TLS connection
- **Values**: `true` (recommended) or `false`
- **Default**: `true`

### 6. INITIAL_EMAIL_LIMIT
- **Description**: Number of emails to process on first setup
- **Purpose**: Prevents processing too many old emails when first configuring
- **Default**: `10`
- **Optional**: Can be adjusted based on your needs

## Setup Instructions

### Step 1: Access Admin Configuration
1. Log in as an admin user
2. Navigate to Admin → Configuration
3. You'll see the IMAP Configuration panel

### Step 2: Configure IMAP Settings
1. Click "Edit" next to each setting
2. Enter your IMAP server details
3. Click "Save" to update each setting

### Step 3: Test Connection
1. After configuring all required settings, click "Test Connection"
2. The system will attempt to connect to your IMAP server
3. If successful, you'll see a green checkmark
4. If failed, check your settings and try again

### Step 4: Start Email Processing
Once configuration is complete and tested:
- The system will automatically check for new emails
- Incoming emails will be converted to tickets
- Emails are marked as read after processing

## Gmail Setup (Most Common)

### 1. Enable 2-Factor Authentication
- Go to your Google Account settings
- Enable 2-Factor Authentication

### 2. Generate App Password
- Go to Google Account → Security → App passwords
- Select "Mail" and your device
- Copy the generated 16-character password

### 3. Configure Settings
```
IMAP_HOST: imap.gmail.com
IMAP_PORT: 993
IMAP_USER: your-email@gmail.com
IMAP_PASS: [your-16-character-app-password]
IMAP_SECURE: true
```

## Troubleshooting

### Connection Failed
- Verify your IMAP server hostname and port
- Check username and password
- Ensure SSL/TLS settings are correct
- For Gmail, make sure you're using an App Password

### No Emails Processed
- Check if emails are in the INBOX folder
- Verify the email account has incoming emails
- Check server logs for any errors

### Security Notes
- Never share your IMAP password
- Use App Passwords for Gmail instead of regular passwords
- Consider using environment variables for sensitive data in production

## Advanced Configuration

### Custom Email Providers
Most email providers support IMAP. Common settings:

**Outlook/Office 365:**
```
IMAP_HOST: outlook.office365.com
IMAP_PORT: 993
IMAP_SECURE: true
```

**Yahoo Mail:**
```
IMAP_HOST: imap.mail.yahoo.com
IMAP_PORT: 993
IMAP_SECURE: true
```

**Custom Server:**
```
IMAP_HOST: mail.yourdomain.com
IMAP_PORT: 993 (or 143 for non-SSL)
IMAP_SECURE: true (or false for non-SSL)
```

### Email Processing Behavior
- Only unread emails are processed
- Emails are marked as read after processing
- Attachments are extracted and stored
- The system tracks the last processed email UID to avoid duplicates 