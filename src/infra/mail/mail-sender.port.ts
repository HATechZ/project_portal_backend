export const MAIL_SENDER = Symbol('MAIL_SENDER');

export interface MailMessage {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

export interface MailSender {
  send(message: MailMessage): Promise<{ messageId: string }>;
}
