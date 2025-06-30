const { checkForNewEmails } = require('../src/lib/imap-email-checker');

async function main() {
  try {
    await checkForNewEmails();
    console.log('\n✅ Manual email check completed!');
  } catch (error) {
    console.error('\n❌ Manual email check failed:', error);
    process.exit(1);
  }
  process.exit(0);
}

main(); 