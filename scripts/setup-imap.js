const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const prisma = new PrismaClient();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask user for input
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function setupImapConfig() {
  console.log('🚀 Setting up IMAP Email Ticket System...\n');

  // Ask user for initial email limit
  console.log('📧 Initial Email Setup');
  console.log('When you first configure the system, how many recent unread emails would you like to create tickets for?');
  console.log('This prevents creating tickets for all historical emails at once.\n');
  
  const initialLimit = await askQuestion('Enter number of recent emails to process (default: 10): ');
  const emailLimit = initialLimit.trim() ? parseInt(initialLimit) : 10;

  console.log(`\n✅ Will process ${emailLimit} recent unread emails on first setup.\n`);

  const configs = [
    {
      key: 'IMAP_HOST',
      value: 'imap.gmail.com',
      description: 'IMAP server hostname (e.g., imap.gmail.com)'
    },
    {
      key: 'IMAP_PORT',
      value: '993',
      description: 'IMAP port (993 for SSL, 143 for non-SSL)'
    },
    {
      key: 'IMAP_USER',
      value: 'support@company.com',
      description: 'Email address to check for new emails'
    },
    {
      key: 'IMAP_PASS',
      value: 'your-app-specific-password',
      description: 'Email password or app-specific password'
    },
    {
      key: 'IMAP_SECURE',
      value: 'true',
      description: 'Use SSL/TLS (true for SSL, false for non-SSL)'
    },
    {
      key: 'SUPPORT_EMAIL',
      value: 'support@company.com',
      description: 'Email address for sending support replies'
    },
    {
      key: 'INITIAL_EMAIL_LIMIT',
      value: emailLimit.toString(),
      description: 'Number of recent unread emails to process on first setup'
    }
  ];

  try {
    console.log('📝 Creating configuration entries...\n');
    
    for (const config of configs) {
      await prisma.configuration.upsert({
        where: { key: config.key },
        update: { 
          value: config.value,
          description: config.description,
          updatedAt: new Date(),
          updatedBy: 'system'
        },
        create: {
          key: config.key,
          value: config.value,
          description: config.description,
          updatedBy: 'system'
        }
      });
      console.log(`✅ ${config.key}: ${config.value}`);
    }

    console.log('\n🎉 IMAP configuration setup complete!');
    console.log('\n📋 Next steps:');
    console.log('1. Go to Admin Panel → Configuration');
    console.log('2. Update the IMAP settings with your actual credentials:');
    console.log('   - IMAP_HOST: Your email provider\'s IMAP server');
    console.log('   - IMAP_USER: Your support email address');
    console.log('   - IMAP_PASS: Your email password or app password');
    console.log('3. Test the connection using the admin panel');
    console.log('4. Set up a cron job to call /api/cron/check-emails every 5 minutes');
    console.log('\n📚 For detailed instructions, see: docs/imap-setup.md');

    console.log('\n🔍 How the system works:');
    console.log(`- First run: Will process up to ${emailLimit} recent unread emails`);
    console.log('- Subsequent runs: Only processes new unread emails since last check');
    console.log('- All processed emails are marked as read automatically');
    console.log('- Tickets are created with "OPEN" status and "MEDIUM" priority');

  } catch (error) {
    console.error('❌ Error setting up IMAP config:', error);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

setupImapConfig(); 