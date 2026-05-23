export interface ContactSubmissionEmailInput {
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
}

export type ContactEmailDeliveryResult =
  | { status: "skipped"; reason: "not_configured" }
  | { status: "sent"; id: string | null }
  | { status: "failed"; error: string };

const RESEND_EMAIL_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_CONTACT_EMAIL_TO = "support@aimarketcap.tech";
const DEFAULT_CONTACT_EMAIL_FROM = "AI Market Cap <support@aimarketcap.tech>";

function readContactEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    from: process.env.CONTACT_EMAIL_FROM?.trim() || DEFAULT_CONTACT_EMAIL_FROM,
    to: process.env.CONTACT_EMAIL_TO?.trim() || DEFAULT_CONTACT_EMAIL_TO,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildContactEmailText(input: ContactSubmissionEmailInput) {
  return [
    "New AI Market Cap contact submission",
    "",
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Category: ${input.category}`,
    `Subject: ${input.subject}`,
    "",
    input.message,
  ].join("\n");
}

function buildContactEmailHtml(input: ContactSubmissionEmailInput) {
  const rows = [
    ["Name", input.name],
    ["Email", input.email],
    ["Category", input.category],
    ["Subject", input.subject],
  ];

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; line-height: 1.5;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">New contact submission</h1>
      <table style="border-collapse: collapse; width: 100%; max-width: 640px;">
        <tbody>
          ${rows
            .map(
              ([label, value]) => `
                <tr>
                  <th style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; text-align: left; width: 120px;">${escapeHtml(label)}</th>
                  <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${escapeHtml(value)}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
      <h2 style="font-size: 16px; margin: 24px 0 8px;">Message</h2>
      <div style="white-space: pre-wrap; padding: 12px; border: 1px solid #e5e7eb; background: #f9fafb;">${escapeHtml(input.message)}</div>
    </div>
  `;
}

export async function sendContactSubmissionEmail(
  input: ContactSubmissionEmailInput
): Promise<ContactEmailDeliveryResult> {
  const config = readContactEmailConfig();

  if (!config) {
    return { status: "skipped", reason: "not_configured" };
  }

  const response = await fetch(RESEND_EMAIL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "ai-market-cap/1.0",
    },
    body: JSON.stringify({
      from: config.from,
      to: [config.to],
      reply_to: input.email,
      subject: `[AI Market Cap] ${input.subject}`,
      text: buildContactEmailText(input),
      html: buildContactEmailHtml(input),
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | { id?: unknown; message?: unknown; error?: unknown }
    | null;

  if (!response.ok) {
    const error =
      typeof body?.message === "string"
        ? body.message
        : typeof body?.error === "string"
          ? body.error
          : `Email provider returned ${response.status}`;

    return { status: "failed", error };
  }

  return {
    status: "sent",
    id: typeof body?.id === "string" ? body.id : null,
  };
}
