import nodemailer from "nodemailer";

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(config: EmailConfig) {
    this.transporter = nodemailer.createTransport(config);
  }

  async sendOTP(
    to: string,
    code: string,
    companyName: string = "Virtusa"
  ): Promise<boolean> {
    try {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #1e40af 0%, #f97316 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                .otp-code { font-size: 32px; font-weight: bold; color: #1e40af; text-align: center; letter-spacing: 5px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>${companyName} Portal</h1>
                    <p>Employee Authentication</p>
                </div>
                <div class="content">
                    <h2>Your Verification Code</h2>
                    <p>Hello,</p>
                    <p>Use the following OTP code to verify your identity and access the ${companyName} Employee Portal:</p>
                    
                    <div class="otp-code">${code}</div>
                    
                    <p>This code will expire in 10 minutes.</p>
                    <p>If you didn't request this code, please ignore this email.</p>
                </div>
                <div class="footer">
                    <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
      `;

      const text = `
        ${companyName} Portal - Verification Code
        
        Your OTP code is: ${code}
        
        This code will expire in 10 minutes.
        
        If you didn't request this code, please ignore this email.
        
        © ${new Date().getFullYear()} ${companyName}
      `;

      const mailOptions = {
        from:
          process.env.SMTP_FROM ||
          `"${companyName} Portal" <noreply@yourcompany.com>`,
        to,
        subject: `Your ${companyName} Portal Verification Code`,
        text,
        html,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`OTP email sent to ${to}: ${result.messageId}`);
      return true;
    } catch (error) {
      console.error("Failed to send OTP email:", error);
      return false;
    }
  }

  /**
   * ✅ Generic email helper (used by Bulk Buy module)
   */
  async sendMail(opts: {
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    html?: string;
    text?: string;
    fromName?: string;
  }): Promise<boolean> {
    try {
      const fromName = opts.fromName || "Portal";
      const from =
        process.env.SMTP_FROM || `"${fromName}" <noreply@yourcompany.com>`;

      const mailOptions = {
        from,
        to: opts.to,
        cc: opts.cc,
        bcc: opts.bcc,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(
        `Mail sent: subject="${opts.subject}" to=${JSON.stringify(
          opts.to
        )} msgId=${result.messageId}`
      );
      return true;
    } catch (error) {
      console.error("Failed to send email:", error);
      return false;
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log("SMTP connection verified");
      return true;
    } catch (error) {
      console.error("SMTP connection failed:", error);
      return false;
    }
  }
}

export const emailService = new EmailService({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
});
