import { Resend } from "resend";
import { env } from "../../config/env";

export type SendEmailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
};

let resendClient: Resend | null = null;

function getResendClient() {
  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }

  return resendClient;
}

function normalizeToAddresses(to: string | string[]) {
  return Array.isArray(to) ? to : [to];
}

function resolveFromAddress(from?: string) {
  return from ?? env.RESEND_FROM;
}

function resolveFromHeader(from?: string) {
  const fromAddress = resolveFromAddress(from);
  const fromName = env.RESEND_FROM_NAME.replace(/[\r\n"]/g, "").trim();

  return `${fromName} <${fromAddress}>`;
}

async function withResendTimeout<T>(operation: Promise<T>) {
  const timeoutMs = env.RESEND_TIMEOUT * 1000;

  return await Promise.race([
    operation,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Resend request timed out after ${env.RESEND_TIMEOUT} seconds`));
      }, timeoutMs);
    }),
  ]);
}

export async function sendEmail(options: SendEmailOptions) {
  const response = await withResendTimeout(
    getResendClient().emails.send({
      from: resolveFromHeader(options.from),
      to: normalizeToAddresses(options.to),
      subject: options.subject,
      html: options.html,
    })
  );

  if (response.error) {
    throw new Error(response.error.message || "Failed to send email via Resend");
  }

  return response.data;
}

export async function sendEmailBatch(emails: SendEmailOptions[]) {
  const response = await withResendTimeout(
    getResendClient().batch.send(
      emails.map((email) => ({
        from: resolveFromHeader(email.from),
        to: normalizeToAddresses(email.to),
        subject: email.subject,
        html: email.html,
      }))
    )
  );

  if (response.error) {
    throw new Error(response.error.message || "Failed to send batch emails via Resend");
  }

  return response.data;
}
