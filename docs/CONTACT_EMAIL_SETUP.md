# Contact Email Setup

The general contact form saves submissions in Supabase and notifies administrators
before sending a support notification through Resend. Marketplace listing inquiries
use the existing seller-notification path instead. Supabase Auth SMTP is separate;
configuring contact notifications does not require changing login-email settings.

## Configuration

- Set `RESEND_API_KEY` on the production web service, never in a public/client variable.
- The default sender is `AI Market Cap <support@aimarketcap.tech>`.
- The default recipient is `support@aimarketcap.tech`.
- `CONTACT_EMAIL_FROM` and `CONTACT_EMAIL_TO` optionally override those defaults.
- Preserve dashboard-managed secrets in `.railway/railway.ts`; do not apply a stale
  infrastructure graph that omits newly added variables.

Add the sender domain in Resend and publish the exact sending records returned by
Resend. Check existing records for conflicts before writing DNS. Do not replace the
domain's receiving MX records or its existing SPF configuration. Resend's sending
return-path MX/SPF records belong on its specified subdomain, not the domain root.
Keep receiving disabled in Resend when the existing mailbox provider receives mail.
Verify the domain before testing delivery. Prefer disabled tracking for support mail.

## Failure Behavior

Missing configuration skips email delivery. Provider rejection, network failures,
malformed success responses, and the 10-second request timeout return a failed result
without exposing raw provider errors. The contact route logs this failure and still
acknowledges the saved submission. An email failure must not encourage a duplicate
form submission after the database insert has succeeded.

There is no durable email outbox or automatic retry in this path. Administrators
should use the stored contact queue as the source of truth for inquiries; email is
a notification, not the only copy of a lead.

## Verification

Run `npx vitest run --project unit src/lib/email/contact-email.test.ts src/app/api/contact/route.test.ts`.
After production configuration and DNS verification, submit one clearly labelled
internal test through `/contact`. Confirm the saved test submission, administrator
notification, and the matching Resend delivery event. API acceptance alone is not
proof of delivery, and a delivered event does not prove a human read the message.
