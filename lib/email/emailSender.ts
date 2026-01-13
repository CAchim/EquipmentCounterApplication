import nodemailer, { Transporter } from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import dotenv from "dotenv";

dotenv.config(); //

export class EmailSender {
  private transporter: Transporter<SMTPTransport.SentMessageInfo>;
  private from: string;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER || "";
    const pass = process.env.SMTP_PASS || "";
    const from = process.env.SMTP_FROM || user;
    const secureFlag = process.env.SMTP_SECURE; // "true" / "false" / undefined
    const service = process.env.SMTP_SERVICE || undefined;
    const rejectUnauthorized =
      process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false";

    if (!host) {
      console.error("[EmailSender] SMTP_HOST is missing in environment.");
      throw new Error("SMTP_HOST is missing in .env");
    }

    this.from = from;

    const secure =
      typeof secureFlag === "string"
        ? secureFlag === "true"
        : port === 465; 

    const config: SMTPTransport.Options = {
      host,
      port,
      secure,
      service,
      auth:
        user && pass
          ? {
              user,
              pass,
            }
          : undefined,
      tls: {
        rejectUnauthorized,
      },
    };

    console.log("[EmailSender] SMTP config loaded from ENV:", {
      host,
      port,
      secure,
      service,
      from,
      authUser: user ? "(provided)" : "(none)",
      rejectUnauthorized,
    });

    this.transporter = nodemailer.createTransport(config);
  }

  private isEmailValid(email: string | null | undefined): email is string {
    if (!email) return false;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  async sendEmail(
    to: string | null | undefined,
    subject: string,
    html: string,
    options?: { cc?: string[]; bcc?: string[] }
  ): Promise<boolean> {
    if (!this.isEmailValid(to)) {
      console.error(`[EmailSender] Invalid or empty recipient email: "${to}"`);
      return false;
    }

    try {
      console.log(
        `[EmailSender] Sending email: to=${to}, subject="${subject}", from=${this.from}`
      );

      const mailOptions: nodemailer.SendMailOptions = {
        from: this.from,
        to,
        subject,
        html,
      };

      // ✅ apply CC/BCC BEFORE sending
      if (options?.cc?.length) mailOptions.cc = options.cc;
      if (options?.bcc?.length) mailOptions.bcc = options.bcc;

      const info = await this.transporter.sendMail(mailOptions);

      console.log(
        `[EmailSender] Email sent successfully to ${to}, messageId=${info.messageId}`
      );
      return true;
    } catch (err) {
      console.error("[EmailSender] Failed to send email:", err);
      return false;
    }
  }

}
