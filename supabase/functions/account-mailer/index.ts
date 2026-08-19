import nodemailer from "npm:nodemailer@6.9.16";
import { withAutomationSecret } from "../_shared/automation-auth.ts";

interface RevertEmailPayload {
  user_id: string;
  old_email: string;
  new_email: string;
  raw_token: string;
  expires_at: string;
}

function getSiteUrl(): string {
  return Deno.env.get("SITE_URL") ?? "http://127.0.0.1:3000";
}

function buildRevertEmailHtml(payload: RevertEmailPayload, siteUrl: string): string {
  const revertUrl = `${siteUrl}/auth/revert-email?token=${encodeURIComponent(payload.raw_token)}`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>Architype email changed</title></head>
<body style="margin:0;padding:0;background-color:#0b0f14;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0b0f14;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background-color:#121820;border:1px solid #1e2a38;border-radius:16px;padding:32px 28px;">
        <tr><td align="center" style="padding-bottom:24px;">
          <img src="${siteUrl}/favicon.svg" alt="Architype" width="40" height="40" style="display:block;" />
        </td></tr>
        <tr><td style="color:#e8eef4;font-size:22px;font-weight:600;text-align:center;padding-bottom:8px;">
          Your Architype email changed
        </td></tr>
        <tr><td style="color:#8b9cb3;font-size:14px;line-height:1.6;text-align:center;padding-bottom:24px;">
          Your account email changed from <strong style="color:#e8eef4;">${payload.old_email}</strong>
          to <strong style="color:#e8eef4;">${payload.new_email}</strong>.
          If this was not you, revert the change within 7 days. You do not need to sign in.
        </td></tr>
        <tr><td align="center" style="padding-bottom:24px;">
          <a href="${revertUrl}" style="display:inline-block;background-color:#00f5ff;color:#041018;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:999px;">
            Revert email change
          </a>
        </td></tr>
        <tr><td style="color:#6b7d94;font-size:12px;line-height:1.5;text-align:center;">
          If you made this change, you can ignore this email.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendRevertEmail(payload: RevertEmailPayload): Promise<void> {
  const smtpHost = Deno.env.get("ACCOUNT_SMTP_HOST") ?? "inbucket";
  const smtpPort = Number(Deno.env.get("ACCOUNT_SMTP_PORT") ?? "1025");
  const smtpUser = Deno.env.get("ACCOUNT_SMTP_USER");
  const smtpPass = Deno.env.get("ACCOUNT_SMTP_PASS");
  const smtpFrom =
    Deno.env.get("ACCOUNT_SMTP_FROM") ?? "Architype <admin@email.com>";
  const siteUrl = getSiteUrl();

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: false,
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    tls: {
      rejectUnauthorized: false,
    },
  });

  await transporter.sendMail({
    from: smtpFrom,
    to: payload.old_email,
    subject: "Revert your Architype email change",
    html: buildRevertEmailHtml(payload, siteUrl),
  });
}

Deno.serve(
  withAutomationSecret(async (req) => {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    let payload: RevertEmailPayload;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (
      !payload.old_email ||
      !payload.new_email ||
      !payload.raw_token ||
      !payload.user_id
    ) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      await sendRevertEmail(payload);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[account-mailer] send failed:", message);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
);
