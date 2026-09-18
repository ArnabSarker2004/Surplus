import nodemailer from 'nodemailer';
import { emailConfigured } from './identity-providers';

export interface AuthMailer {
  sendCode(email: string, code: string): Promise<void>;
}
export class SmtpAuthMailer implements AuthMailer {
  async sendCode(email: string, code: string) {
    if (!emailConfigured()) throw new Error('Email delivery is not configured');
    const port = Number(process.env.SMTP_PORT || '587');
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    try {
      await transport.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: 'Your Surplus sign-in code',
        text: `Your Surplus code is ${code}.\n\nIt expires in 10 minutes and can only be used once in the browser that requested it. Never share this code.\n\nIf you did not request it, you can ignore this email.`,
      });
    } finally {
      transport.close();
    }
  }
}
