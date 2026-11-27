import type { Config } from '../config';

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  name: string;
  send(email: Email): Promise<void>;
}

/** Prints emails to the API log. The default in development and whenever no provider is configured. */
export function createLogProvider(log: (line: string) => void = (l) => console.log(l)): EmailProvider {
  return {
    name: 'log',
    async send(e) {
      log(JSON.stringify({ msg: 'email.log', to: e.to, subject: e.subject, text: e.text.slice(0, 400) }));
    },
  };
}

/** "Brand <orders@example.in>" → { name, email } */
export function parseFrom(from: string): { name: string; email: string } {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  return m ? { name: m[1]!.replace(/^"|"$/g, ''), email: m[2]! } : { name: '', email: from.trim() };
}

async function post(url: string, headers: Record<string, string>, body: unknown, fetchImpl: typeof fetch) {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`email provider ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
}

/** Resend (https://resend.com): free tier about 100 emails/day. */
export function createResendProvider(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): EmailProvider {
  return {
    name: 'resend',
    send: (e) => post('https://api.resend.com/emails', { authorization: `Bearer ${apiKey}` }, { from, to: [e.to], subject: e.subject, html: e.html, text: e.text }, fetchImpl),
  };
}

/** Brevo (https://www.brevo.com): free tier about 300 emails/day. */
export function createBrevoProvider(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): EmailProvider {
  const sender = parseFrom(from);
  return {
    name: 'brevo',
    send: (e) =>
      post(
        'https://api.brevo.com/v3/smtp/email',
        { 'api-key': apiKey },
        { sender: { name: sender.name || undefined, email: sender.email }, to: [{ email: e.to }], subject: e.subject, htmlContent: e.html, textContent: e.text },
        fetchImpl,
      ),
  };
}

export function createEmailProvider(config: Config): EmailProvider {
  switch (config.EMAIL_PROVIDER) {
    case 'resend':
      return createResendProvider(config.RESEND_API_KEY, config.EMAIL_FROM);
    case 'brevo':
      return createBrevoProvider(config.BREVO_API_KEY, config.EMAIL_FROM);
    default:
      return createLogProvider();
  }
}
