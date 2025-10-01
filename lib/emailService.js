const nodemailer = require('nodemailer');

// Create transporter - FIXED: createTransport not createTransporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

class EmailService {
  static async sendVerificationEmail(email, token, teamName) {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/verify-email?token=${token}`;
    
    const mailOptions = {
      from: `"CipherQuest" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your Email - CipherQuest',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6366f1; text-align: center;">Welcome to CipherQuest! 🎉</h2>
          <p>Hello <strong>${teamName}</strong>,</p>
          <p>Thank you for registering for CipherQuest Hackathon. To complete your registration, please verify your email address:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p>Or copy this link to your browser:</p>
          <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
          <p>Best regards,<br>CipherQuest Team</p>
        </div>
      `
    };

    try {
      // If email credentials are not set, simulate sending
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log(`📧 [SIMULATED] Verification email would be sent to: ${email}`);
        console.log(`🔗 Verification URL: ${verificationUrl}`);
        console.log(`🏆 Team: ${teamName}`);
        return true;
      }

      await transporter.sendMail(mailOptions);
      console.log(`✅ Verification email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      console.log(`📧 [FALLBACK] Verification token for ${email}: ${token}`);
      return true; // Return true to not block registration
    }
  }

  static async sendPasswordResetEmail(email, token, teamName) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reset-password?token=${token}`;
    
    const mailOptions = {
      from: `"CipherQuest" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset - CipherQuest',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6366f1;">Password Reset Request</h2>
          <p>Hello <strong>${teamName}</strong>,</p>
          <p>We received a request to reset your password for your CipherQuest account.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>Or copy this link to your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <p>Best regards,<br>CipherQuest Team</p>
        </div>
      `
    };

    try {
      // If email credentials are not set, simulate sending
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log(`📧 [SIMULATED] Password reset email would be sent to: ${email}`);
        console.log(`🔗 Reset URL: ${resetUrl}`);
        console.log(`🏆 Team: ${teamName}`);
        return true;
      }

      await transporter.sendMail(mailOptions);
      console.log(`✅ Password reset email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Password reset email failed:', error);
      console.log(`📧 [FALLBACK] Password reset token for ${email}: ${token}`);
      return true; // Return true to not block password reset flow
    }
  }

  // Test email connection
  static async testConnection() {
    try {
      // If no email credentials, simulate success
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log('📧 [SIMULATED] Email service running in simulation mode');
        return true;
      }

      await transporter.verify();
      console.log('✅ Email server connection successful');
      return true;
    } catch (error) {
      console.error('❌ Email server connection failed:', error);
      console.log('📧 Switching to simulation mode for emails');
      return false;
    }
  }

  // Send team qualification email
  static async sendQualificationEmail(email, teamName, problemStatement) {
    const mailOptions = {
      from: `"CipherQuest" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Congratulations! You Qualified for CipherQuest Build Phase',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6366f1; text-align: center;">🎉 Congratulations ${teamName}! 🎉</h2>
          <p>You have successfully completed the CipherQuest challenge and qualified for the Build Phase!</p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #6366f1;">Your Assigned Problem:</h3>
            <p><strong>${problemStatement.title}</strong></p>
            <p>${problemStatement.description}</p>
          </div>

          <p><strong>Next Steps:</strong></p>
          <ul>
            <li>Login to your CipherQuest dashboard</li>
            <li>Review the complete problem statement and guidelines</li>
            <li>Start working on your solution</li>
            <li>Submit your PPT and prototype before the deadline</li>
          </ul>

          <p>Best of luck with your project!<br>CipherQuest Team</p>
        </div>
      `
    };

    try {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log(`📧 [SIMULATED] Qualification email would be sent to: ${email}`);
        console.log(`🏆 Team ${teamName} qualified for problem: ${problemStatement.title}`);
        return true;
      }

      await transporter.sendMail(mailOptions);
      console.log(`✅ Qualification email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Qualification email failed:', error);
      return true;
    }
  }

  // Send submission confirmation email
  static async sendSubmissionConfirmation(email, teamName, submissionDetails) {
    const mailOptions = {
      from: `"CipherQuest" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'CipherQuest Submission Received',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6366f1; text-align: center;">📬 Submission Confirmed</h2>
          <p>Hello <strong>${teamName}</strong>,</p>
          <p>Your CipherQuest project submission has been received successfully!</p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #6366f1;">Submission Details:</h3>
            <p><strong>Submission Time:</strong> ${new Date().toLocaleString()}</p>
            ${submissionDetails.pptUrl ? `<p><strong>PPT:</strong> ${submissionDetails.pptUrl}</p>` : ''}
            ${submissionDetails.prototypeUrl ? `<p><strong>Prototype:</strong> ${submissionDetails.prototypeUrl}</p>` : ''}
            ${submissionDetails.githubUrl ? `<p><strong>GitHub:</strong> ${submissionDetails.githubUrl}</p>` : ''}
          </div>

          <p><strong>What's Next?</strong></p>
          <ul>
            <li>Your submission is now under review by our judges</li>
            <li>Check the leaderboard for updates</li>
            <li>Winners will be announced soon!</li>
          </ul>

          <p>Thank you for participating in CipherQuest!<br>CipherQuest Team</p>
        </div>
      `
    };

    try {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log(`📧 [SIMULATED] Submission confirmation would be sent to: ${email}`);
        console.log(`✅ Team ${teamName} submission confirmed`);
        return true;
      }

      await transporter.sendMail(mailOptions);
      console.log(`✅ Submission confirmation sent to ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Submission confirmation email failed:', error);
      return true;
    }
  }
}

// Test email configuration on startup
EmailService.testConnection().then(success => {
  if (success) {
    console.log('📧 EmailService initialized successfully');
  } else {
    console.log('📧 EmailService running in simulation mode');
  }
});

module.exports = EmailService;
