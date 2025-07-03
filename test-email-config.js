const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');

const prisma = new PrismaClient();

async function testEmailConfig() {
  try {
    console.log('Testing email configuration...\n');

    // Get email configuration from database
    const configs = await prisma.configuration.findMany({
      where: {
        key: {
          in: [
            "EMAIL_HOST",
            "EMAIL_PORT", 
            "EMAIL_USER",
            "EMAIL_PASS",
            "SUPPORT_EMAIL",
          ],
        },
      },
    });

    const configMap = configs.reduce((acc, config) => {
      acc[config.key] = config.value;
      return acc;
    }, {});

    console.log('Email configuration found:');
    console.log('- EMAIL_HOST:', configMap.EMAIL_HOST);
    console.log('- EMAIL_PORT:', configMap.EMAIL_PORT);
    console.log('- EMAIL_USER:', configMap.EMAIL_USER);
    console.log('- EMAIL_PASS:', configMap.EMAIL_PASS ? '[SET]' : '[NOT SET]');
    console.log('- SUPPORT_EMAIL:', configMap.SUPPORT_EMAIL);
    console.log('');

    // Check if configuration is properly set
    if (!configMap.EMAIL_HOST || configMap.EMAIL_HOST === 'smtp.gmail.com') {
      console.log('❌ EMAIL_HOST is not properly configured (still using default value)');
    } else {
      console.log('✅ EMAIL_HOST is configured');
    }

    if (!configMap.EMAIL_USER || configMap.EMAIL_USER === 'your-email@gmail.com') {
      console.log('❌ EMAIL_USER is not properly configured (still using default value)');
    } else {
      console.log('✅ EMAIL_USER is configured');
    }

    if (!configMap.EMAIL_PASS || configMap.EMAIL_PASS === 'your-app-password') {
      console.log('❌ EMAIL_PASS is not properly configured (still using default value)');
    } else {
      console.log('✅ EMAIL_PASS is configured');
    }

    console.log('');

    // Test SMTP connection
    if (configMap.EMAIL_HOST && configMap.EMAIL_USER && configMap.EMAIL_PASS) {
      console.log('Testing SMTP connection...');
      
      const transporter = nodemailer.createTransport({
        host: configMap.EMAIL_HOST,
        port: parseInt(configMap.EMAIL_PORT || '587'),
        secure: false,
        auth: {
          user: configMap.EMAIL_USER,
          pass: configMap.EMAIL_PASS,
        },
      });

      try {
        await transporter.verify();
        console.log('✅ SMTP connection successful!');
        
        // Try to send a test email
        console.log('Sending test email...');
        const info = await transporter.sendMail({
          from: configMap.SUPPORT_EMAIL || configMap.EMAIL_USER,
          to: configMap.EMAIL_USER, // Send to self for testing
          subject: 'Test Email from Email Ticketing App',
          text: 'This is a test email to verify the email configuration is working correctly.',
          html: '<h1>Test Email</h1><p>This is a test email to verify the email configuration is working correctly.</p>',
        });
        
        console.log('✅ Test email sent successfully!');
        console.log('Message ID:', info.messageId);
        
      } catch (error) {
        console.log('❌ SMTP connection failed:', error.message);
        console.log('Full error:', error);
      }
    } else {
      console.log('❌ Cannot test SMTP connection - configuration is incomplete');
    }

  } catch (error) {
    console.error('Error testing email configuration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testEmailConfig(); 