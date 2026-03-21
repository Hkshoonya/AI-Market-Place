const BRAND = {
  siteName: "AI Market Cap",
  siteUrl: "https://aimarketcap.tech",
  supportEmail: "support@aimarketcap.tech",
  background: "#050505",
  surface: "#0C0C0C",
  border: "#1E1E1E",
  accent: "#00D4AA",
  text: "#F5F7F7",
  muted: "#A7B1AE",
  soft: "#6E7875",
};

function frameEmail({
  eyebrow,
  title,
  intro,
  body,
  ctaLabel,
  ctaHref,
  secondaryLabel,
  secondaryHref,
  detailRows = [],
  note,
}) {
  const details = detailRows.length
    ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0; border: 1px solid ${BRAND.border}; border-radius: 16px; background: ${BRAND.surface};">
        ${detailRows
          .map(
            ({ label, value }) => `
          <tr>
            <td style="padding: 12px 18px; border-bottom: 1px solid ${BRAND.border}; color: ${BRAND.muted}; font-size: 13px; width: 36%;">${label}</td>
            <td style="padding: 12px 18px; border-bottom: 1px solid ${BRAND.border}; color: ${BRAND.text}; font-size: 14px;">${value}</td>
          </tr>`,
          )
          .join("")}
      </table>`
    : "";

  const secondary = secondaryLabel && secondaryHref
    ? `
      <p style="margin: 0 0 24px;">
        <a href="${secondaryHref}" style="color: ${BRAND.accent}; text-decoration: none; font-weight: 600;">${secondaryLabel}</a>
      </p>`
    : "";

  const noteBlock = note
    ? `<p style="margin: 0 0 18px; color: ${BRAND.soft}; font-size: 13px; line-height: 1.7;">${note}</p>`
    : "";

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin: 0; padding: 0; background: ${BRAND.background}; color: ${BRAND.text}; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${BRAND.background};">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 640px; border: 1px solid ${BRAND.border}; border-radius: 24px; overflow: hidden; background: #090909;">
            <tr>
              <td style="padding: 24px 28px; border-bottom: 1px solid ${BRAND.border}; background: #070707;">
                <div style="display: inline-block; padding: 8px 12px; border-radius: 999px; border: 1px solid rgba(0, 212, 170, 0.28); color: ${BRAND.accent}; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700;">
                  ${eyebrow}
                </div>
                <h1 style="margin: 18px 0 10px; color: ${BRAND.text}; font-size: 30px; line-height: 1.2; font-weight: 800;">${title}</h1>
                <p style="margin: 0; color: ${BRAND.muted}; font-size: 15px; line-height: 1.7;">${intro}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 28px;">
                <div style="color: ${BRAND.text}; font-size: 15px; line-height: 1.8;">
                  ${body}
                </div>
                ${details}
                <p style="margin: 0 0 18px;">
                  <a href="${ctaHref}" style="display: inline-block; padding: 14px 22px; border-radius: 12px; background: ${BRAND.accent}; color: #04110D; text-decoration: none; font-size: 15px; font-weight: 800;">
                    ${ctaLabel}
                  </a>
                </p>
                ${secondary}
                ${noteBlock}
                <p style="margin: 24px 0 0; color: ${BRAND.muted}; font-size: 13px; line-height: 1.7;">
                  Need help? Reply to this message or contact
                  <a href="mailto:${BRAND.supportEmail}" style="color: ${BRAND.accent}; text-decoration: none;">${BRAND.supportEmail}</a>.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 18px 28px 24px; border-top: 1px solid ${BRAND.border}; color: ${BRAND.soft}; font-size: 12px; line-height: 1.8;">
                Transactional security email from ${BRAND.siteName}. No marketing, no tracking pixels, and no extra links beyond what you need to complete this action.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();
}

export function buildSupabaseAuthTemplatePatch() {
  const siteUrl = "{{ .SiteURL }}";
  const confirmationUrl = "{{ .ConfirmationURL }}";
  const token = "{{ .Token }}";
  const email = "{{ .Email }}";
  const newEmail = "{{ .NewEmail }}";
  const oldEmail = "{{ .OldEmail }}";
  const phone = "{{ .Phone }}";
  const oldPhone = "{{ .OldPhone }}";
  const provider = "{{ .Provider }}";
  const factorType = "{{ .FactorType }}";

  return {
    mailer_subjects_confirmation: "Confirm your AI Market Cap account",
    mailer_templates_confirmation_content: frameEmail({
      eyebrow: "Account Confirmation",
      title: "Confirm your account",
      intro: "Complete your AI Market Cap signup so your account, rankings, and marketplace access are ready when you return.",
      body: `<p style="margin: 0 0 18px;">This confirmation secures the email address attached to your AI Market Cap account.</p>`,
      ctaLabel: "Confirm account",
      ctaHref: confirmationUrl,
      secondaryLabel: "Open AI Market Cap",
      secondaryHref: siteUrl,
      note: "If you did not create this account, you can safely ignore this email.",
    }),
    mailer_subjects_magic_link: "Your AI Market Cap sign-in link",
    mailer_templates_magic_link_content: frameEmail({
      eyebrow: "Secure Sign-In",
      title: "Use your secure sign-in link",
      intro: "Open AI Market Cap with a single secure link. No password is required for this sign-in.",
      body: `<p style="margin: 0 0 18px;">This sign-in link is unique to your request and should only be used by you.</p>`,
      ctaLabel: "Sign in to AI Market Cap",
      ctaHref: confirmationUrl,
      secondaryLabel: "Visit homepage",
      secondaryHref: siteUrl,
      note: "If you did not request this email, you can ignore it. Your account stays secure until the link is used.",
    }),
    mailer_subjects_recovery: "Reset your AI Market Cap password",
    mailer_templates_recovery_content: frameEmail({
      eyebrow: "Password Reset",
      title: "Reset your password",
      intro: "Use the secure link below to choose a new password and regain access to your AI Market Cap account.",
      body: `<p style="margin: 0 0 18px;">We only sent this because a password reset was requested for your account.</p>`,
      ctaLabel: "Reset password",
      ctaHref: confirmationUrl,
      secondaryLabel: "Go to AI Market Cap",
      secondaryHref: siteUrl,
      note: "If you did not request a password reset, you can ignore this email. Your current password will remain unchanged.",
    }),
    mailer_subjects_invite: "You’re invited to AI Market Cap",
    mailer_templates_invite_content: frameEmail({
      eyebrow: "Invitation",
      title: "You’ve been invited",
      intro: "Join AI Market Cap to access model rankings, live benchmarks, and the AI-native marketplace experience tied to your invite.",
      body: `<p style="margin: 0 0 18px;">Accept your invitation to create or activate your account.</p>`,
      ctaLabel: "Accept invitation",
      ctaHref: confirmationUrl,
      secondaryLabel: "Explore AI Market Cap",
      secondaryHref: siteUrl,
      note: "If this invite reached you unexpectedly, you can ignore it.",
    }),
    mailer_subjects_reauthentication: "Confirm it’s you",
    mailer_templates_reauthentication_content: frameEmail({
      eyebrow: "Security Check",
      title: "Enter your verification code",
      intro: "AI Market Cap needs one more step to confirm this sensitive action belongs to you.",
      body: `<p style="margin: 0 0 8px;">Use the verification code below to continue:</p>`,
      ctaLabel: token,
      ctaHref: siteUrl,
      detailRows: [{ label: "Verification code", value: `<span style="font-size: 22px; font-weight: 800; letter-spacing: 0.2em;">${token}</span>` }],
      note: "Do not share this code with anyone. AI Market Cap will never ask for it outside the verification flow.",
    }),
    mailer_subjects_email_change: "Confirm your new email",
    mailer_templates_email_change_content: frameEmail({
      eyebrow: "Email Change",
      title: "Confirm your email update",
      intro: "Approve this email change to finish updating the sign-in address on your AI Market Cap account.",
      body: `<p style="margin: 0 0 18px;">Your account is moving to <strong style="color: ${BRAND.text};">${newEmail}</strong>.</p>`,
      ctaLabel: "Confirm email change",
      ctaHref: confirmationUrl,
      secondaryLabel: "Open AI Market Cap",
      secondaryHref: siteUrl,
      detailRows: [{ label: "New email", value: newEmail }],
      note: "If you did not request this change, do not click the button and contact support immediately.",
    }),
    mailer_subjects_password_changed_notification: "Your AI Market Cap password changed",
    mailer_templates_password_changed_notification_content: frameEmail({
      eyebrow: "Security Notice",
      title: "Your password was changed",
      intro: "This is a confirmation that the password on your AI Market Cap account has been updated.",
      body: `<p style="margin: 0 0 18px;">If this was you, no action is needed.</p>`,
      ctaLabel: "Review account activity",
      ctaHref: `${siteUrl}/activity`,
      secondaryLabel: "Sign in to AI Market Cap",
      secondaryHref: `${siteUrl}/login`,
      detailRows: [{ label: "Account", value: email }],
      note: "If you did not make this change, reset your password immediately and contact support.",
    }),
    mailer_subjects_email_changed_notification: "Your AI Market Cap email changed",
    mailer_templates_email_changed_notification_content: frameEmail({
      eyebrow: "Security Notice",
      title: "Your email address was changed",
      intro: "The email address associated with your AI Market Cap account has been updated.",
      body: `<p style="margin: 0 0 18px;">If this was expected, your account is ready to use with the new address.</p>`,
      ctaLabel: "Review account activity",
      ctaHref: `${siteUrl}/activity`,
      secondaryLabel: "Open sign-in",
      secondaryHref: `${siteUrl}/login`,
      detailRows: [
        { label: "Previous email", value: oldEmail },
        { label: "Current email", value: email },
      ],
      note: "If you did not authorize this change, contact support immediately.",
    }),
    mailer_subjects_phone_changed_notification: "Your AI Market Cap phone changed",
    mailer_templates_phone_changed_notification_content: frameEmail({
      eyebrow: "Security Notice",
      title: "Your phone number was changed",
      intro: "The phone number connected to your AI Market Cap account has been updated.",
      body: `<p style="margin: 0 0 18px;">If this was expected, no further action is needed.</p>`,
      ctaLabel: "Review account activity",
      ctaHref: `${siteUrl}/activity`,
      secondaryLabel: "Sign in to AI Market Cap",
      secondaryHref: `${siteUrl}/login`,
      detailRows: [
        { label: "Previous phone", value: oldPhone },
        { label: "Current phone", value: phone },
      ],
      note: "If you did not make this change, contact support immediately.",
    }),
    mailer_subjects_mfa_factor_enrolled_notification: "A new security factor was added",
    mailer_templates_mfa_factor_enrolled_notification_content: frameEmail({
      eyebrow: "Security Notice",
      title: "A new MFA method was added",
      intro: "AI Market Cap recorded a new multi-factor authentication method on your account.",
      body: `<p style="margin: 0 0 18px;">This makes sign-in more secure when it was authorized by you.</p>`,
      ctaLabel: "Review account security",
      ctaHref: `${siteUrl}/activity`,
      secondaryLabel: "Open AI Market Cap",
      secondaryHref: siteUrl,
      detailRows: [
        { label: "Account", value: email },
        { label: "Factor type", value: factorType },
      ],
      note: "If you did not add this factor, contact support immediately.",
    }),
    mailer_subjects_mfa_factor_unenrolled_notification: "A security factor was removed",
    mailer_templates_mfa_factor_unenrolled_notification_content: frameEmail({
      eyebrow: "Security Notice",
      title: "An MFA method was removed",
      intro: "A multi-factor authentication method was removed from your AI Market Cap account.",
      body: `<p style="margin: 0 0 18px;">If this was you, no action is required.</p>`,
      ctaLabel: "Review account security",
      ctaHref: `${siteUrl}/activity`,
      secondaryLabel: "Open AI Market Cap",
      secondaryHref: siteUrl,
      detailRows: [
        { label: "Account", value: email },
        { label: "Factor type", value: factorType },
      ],
      note: "If you did not remove this factor, contact support immediately.",
    }),
    mailer_subjects_identity_linked_notification: "A new sign-in identity was linked",
    mailer_templates_identity_linked_notification_content: frameEmail({
      eyebrow: "Security Notice",
      title: "A new identity was linked",
      intro: "A new external sign-in identity was connected to your AI Market Cap account.",
      body: `<p style="margin: 0 0 18px;">This can happen when you connect another sign-in provider to the same account.</p>`,
      ctaLabel: "Review account activity",
      ctaHref: `${siteUrl}/activity`,
      secondaryLabel: "Open AI Market Cap",
      secondaryHref: siteUrl,
      detailRows: [
        { label: "Account", value: email },
        { label: "Provider", value: provider },
      ],
      note: "If you did not link this identity, contact support immediately.",
    }),
    mailer_subjects_identity_unlinked_notification: "A sign-in identity was removed",
    mailer_templates_identity_unlinked_notification_content: frameEmail({
      eyebrow: "Security Notice",
      title: "An identity was removed",
      intro: "A connected sign-in identity was removed from your AI Market Cap account.",
      body: `<p style="margin: 0 0 18px;">If this was expected, your remaining sign-in methods stay active.</p>`,
      ctaLabel: "Review account activity",
      ctaHref: `${siteUrl}/activity`,
      secondaryLabel: "Open AI Market Cap",
      secondaryHref: siteUrl,
      detailRows: [
        { label: "Account", value: email },
        { label: "Provider", value: provider },
      ],
      note: "If you did not remove this identity, contact support immediately.",
    }),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(`${JSON.stringify(buildSupabaseAuthTemplatePatch(), null, 2)}\n`);
}
