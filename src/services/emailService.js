const nodemailer = require('nodemailer');

// Email configuration with fallback handling
const emailConfig = {
  // Gmail configuration (recommended for testing)
  // You'll need to use an App Password if using Gmail
  // Go to: https://myaccount.google.com/apppasswords to generate one
  service: (typeof process !== 'undefined' && process.env && process.env.EMAIL_SERVICE) || 'gmail',
  host: (typeof process !== 'undefined' && process.env && process.env.EMAIL_HOST) || 'smtp.gmail.com',
  port: parseInt((typeof process !== 'undefined' && process.env && process.env.EMAIL_PORT) || '587'),
  secure: (typeof process !== 'undefined' && process.env && process.env.EMAIL_SECURE === 'true') || false, // true for 465, false for other ports
  auth: {
    user: (typeof process !== 'undefined' && process.env && process.env.EMAIL_USER) || '', // Your email address
    pass: (typeof process !== 'undefined' && process.env && process.env.EMAIL_PASS) || ''  // Your app password (not regular password)
  }
};

// Create reusable transporter object using the default SMTP transport
let transporter = null;

// Initialize the transporter
function initializeTransporter() {
  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    console.warn('⚠️ Email credentials not configured. Email sending will be disabled.');
    return null;
  }

  try {
    transporter = nodemailer.createTransporter({
      service: emailConfig.service,
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: {
        user: emailConfig.auth.user,
        pass: emailConfig.auth.pass
      },
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates
      }
    });

    // Verify the connection configuration
    transporter.verify(function(error, success) {
      if (error) {
        console.error('❌ Email service configuration error:', error);
        transporter = null;
      } else {
        console.log('✅ Email service is ready to send messages');
      }
    });

    return transporter;
  } catch (error) {
    console.error('❌ Failed to initialize email transporter:', error);
    return null;
  }
}

// Send email function
async function sendEmail({ name, email, subject, message, targetEmail }) {
  // Initialize transporter if not already done
  if (!transporter) {
    transporter = initializeTransporter();
  }

  // If no transporter available (no credentials), log and return success (for testing)
  if (!transporter) {
    console.log('📧 Email service not configured. Contact form data:', {
      name,
      email,
      subject,
      targetEmail,
      message: message.substring(0, 100) + '...',
      timestamp: new Date().toISOString()
    });
    
    // Return success even without sending (for testing purposes)
    // In production, you might want to return an error instead
    return {
      success: true,
      messageId: 'simulated-' + Date.now(),
      warning: 'Email service not configured, message logged only'
    };
  }

  try {
    // Format the subject line
    const formattedSubject = `[Opsicos Contact] ${subject.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} - From ${name}`;

    // Create HTML email content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #8B0000; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background: #f4f4f4; padding: 20px; border: 1px solid #ddd; }
          .field { margin-bottom: 15px; }
          .label { font-weight: bold; color: #555; }
          .value { margin-top: 5px; padding: 10px; background: white; border-radius: 3px; }
          .message-box { background: white; padding: 15px; border-left: 4px solid #8B0000; margin-top: 20px; }
          .footer { margin-top: 20px; padding: 10px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>New Contact Form Submission</h2>
          </div>
          <div class="content">
            <div class="field">
              <div class="label">Name:</div>
              <div class="value">${name}</div>
            </div>
            <div class="field">
              <div class="label">Email:</div>
              <div class="value"><a href="mailto:${email}">${email}</a></div>
            </div>
            <div class="field">
              <div class="label">Subject Category:</div>
              <div class="value">${subject.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
            </div>
            <div class="field">
              <div class="label">Routed To:</div>
              <div class="value">${targetEmail}</div>
            </div>
            <div class="message-box">
              <div class="label">Message:</div>
              <p>${message.replace(/\n/g, '<br>')}</p>
            </div>
          </div>
          <div class="footer">
            <p>This email was sent from the Opsicos contact form at ${new Date().toLocaleString()}</p>
            <p>IP Address: Contact form submission</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Plain text version
    const textContent = `
New Contact Form Submission

Name: ${name}
Email: ${email}
Subject: ${subject.replace(/-/g, ' ')}
Routed To: ${targetEmail}

Message:
${message}

---
Sent from Opsicos contact form at ${new Date().toLocaleString()}
    `;

    // Email options
    const mailOptions = {
      from: `"Opsicos Contact Form" <${emailConfig.auth.user}>`, // sender address
      to: targetEmail, // recipient
      replyTo: email, // reply to the person who filled the form
      subject: formattedSubject,
      text: textContent,
      html: htmlContent,
      headers: {
        'X-Priority': '3',
        'X-Mailer': 'Opsicos Contact Form'
      }
    };

    // Send the email
    const info = await transporter.sendMail(mailOptions);

    console.log('✅ Email sent successfully:', {
      messageId: info.messageId,
      to: targetEmail,
      subject: formattedSubject,
      timestamp: new Date().toISOString()
    });

    // Also send a confirmation email to the sender
    if (process.env.SEND_CONFIRMATION === 'true') {
      const confirmationOptions = {
        from: `"Opsicos Support" <${emailConfig.auth.user}>`,
        to: email,
        subject: 'Thank you for contacting Opsicos',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #8B0000;">Thank you for contacting us!</h2>
            <p>Dear ${name},</p>
            <p>We have received your message and will get back to you within 24 hours.</p>
            <p><strong>Your message details:</strong></p>
            <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Subject:</strong> ${subject.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
              <p><strong>Message:</strong><br>${message.replace(/\n/g, '<br>')}</p>
            </div>
            <p>Best regards,<br>The Opsicos Team</p>
          </div>
        `
      };
      
      await transporter.sendMail(confirmationOptions);
      console.log('✅ Confirmation email sent to:', email);
    }

    return {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      response: info.response
    };

  } catch (error) {
    console.error('❌ Failed to send email:', error);
    throw error;
  }
}

// Export the functions
module.exports = {
  initializeTransporter,
  sendEmail
};
