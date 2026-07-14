/**
 * Zdieľané odosielanie emailov cez Resend (rovnaký kanál ako kontaktný formulár).
 * Ak RESEND_API_KEY nie je nastavený, email sa NEODOŠLE a vráti sa sent:false —
 * volajúci sa nesmie tváriť, že odoslal (analogické k monetizácii §13: bez env
 * netvrdiť úspech). Nikdy nevypisuje API kľúč.
 */
export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SendEmailResult {
  sent: boolean;
  reason?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email] RESEND_API_KEY chýba — neodoslané: "${input.subject}"`);
    return { sent: false, reason: "no_api_key" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Zlavickovo <noreply@zlavickovo.sk>",
        to: [input.to],
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
      }),
    });
    if (!res.ok) {
      console.error(`[email] Resend HTTP ${res.status}`);
      return { sent: false, reason: `resend_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] network error:", (err as Error)?.message);
    return { sent: false, reason: "network" };
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && EMAIL_RE.test(value);
}
