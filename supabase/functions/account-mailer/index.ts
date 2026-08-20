import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import nodemailer from "npm:nodemailer@6.9.16";
import { withAutomationSecret } from "../_shared/automation-auth.ts";

const QUEUE_NAME = "email-revert";
const VISIBILITY_TIMEOUT_SECONDS = 60;
const QUEUE_FETCH_TIMEOUT_MS = 8_000;
const MAX_ATTEMPTS = 10;

interface RevertEmailPayload {
  reversion_id: string;
  user_id: string;
  old_email: string;
  new_email: string;
  raw_token: string;
  expires_at: string;
}

interface QueueMessage {
  msg_id: number;
  read_ct: number;
  message: RevertEmailPayload;
}

interface SupabaseConfig {
  supabaseUrl: string;
  supabaseSecretKey: string;
}

function getSupabaseConfig(): SupabaseConfig {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL environment variable");
  }

  const rawSecretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!rawSecretKeys) {
    throw new Error("Missing SUPABASE_SECRET_KEYS environment variable");
  }

  const supabaseSecretKey = (JSON.parse(rawSecretKeys) as Record<string, string>).default;
  if (!supabaseSecretKey) {
    throw new Error('SUPABASE_SECRET_KEYS does not contain a "default" key');
  }

  return { supabaseUrl, supabaseSecretKey };
}

function getSiteUrl(): string {
  const siteUrl = Deno.env.get("SITE_URL")?.trim().replace(/\/$/, "");
  if (siteUrl) {
    return siteUrl;
  }

  if (isLocalRuntime()) {
    return "http://127.0.0.1:3000";
  }

  throw new Error("Missing SITE_URL environment variable");
}

function isLocalSmtpHost(host: string): boolean {
  return host === "inbucket" || host === "127.0.0.1" || host === "localhost";
}

function isLocalRuntime(): boolean {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const smtpHost = Deno.env.get("ACCOUNT_SMTP_HOST") ?? "inbucket";
  return (
    isLocalSmtpHost(smtpHost) ||
    supabaseUrl.includes("127.0.0.1") ||
    supabaseUrl.includes("localhost")
  );
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

function createSmtpTransporter() {
  const smtpHost = Deno.env.get("ACCOUNT_SMTP_HOST") ?? "inbucket";
  const smtpPort = Number(Deno.env.get("ACCOUNT_SMTP_PORT") ?? "1025");
  const smtpUser = Deno.env.get("ACCOUNT_SMTP_USER");
  const smtpPass = Deno.env.get("ACCOUNT_SMTP_PASS");
  const isLocalDev = isLocalSmtpHost(smtpHost);
  const secure =
    Deno.env.get("ACCOUNT_SMTP_SECURE") === "true" || smtpPort === 465;

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure,
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    requireTLS: !secure && !isLocalDev,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    ...(isLocalDev ? { tls: { rejectUnauthorized: false } } : {}),
  });
}

async function sendRevertEmail(payload: RevertEmailPayload): Promise<void> {
  const smtpFrom =
    Deno.env.get("ACCOUNT_SMTP_FROM") ?? "Architype <admin@email.com>";
  const siteUrl = getSiteUrl();
  const transporter = createSmtpTransporter();

  await transporter.sendMail({
    from: smtpFrom,
    to: payload.old_email,
    subject: "Revert your Architype email change",
    html: buildRevertEmailHtml(payload, siteUrl),
  });
}

async function readQueueMessages(
  queueName: string,
  sleepSeconds: number,
  n: number,
): Promise<QueueMessage[]> {
  const { supabaseUrl, supabaseSecretKey } = getSupabaseConfig();
  const endpoints = [
    `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/read`,
    `${supabaseUrl.replace(/\/$/, "")}/rpc/read`,
  ];

  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseSecretKey,
          Authorization: `Bearer ${supabaseSecretKey}`,
          "Accept-Profile": "pgmq_public",
          "Content-Profile": "pgmq_public",
        },
        body: JSON.stringify({
          queue_name: queueName,
          sleep_seconds: sleepSeconds,
          n,
        }),
        signal: AbortSignal.timeout(QUEUE_FETCH_TIMEOUT_MS),
      });

      if (resp.ok) {
        return (await resp.json()) as QueueMessage[];
      }

      const errText = await resp.text();
      lastError = new Error(`Endpoint ${endpoint} failed (${resp.status}): ${errText}`);
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error("All queue read endpoints failed");
}

async function deleteQueueMessage(msgId: number): Promise<void> {
  const { supabaseUrl, supabaseSecretKey } = getSupabaseConfig();
  const endpoints = [
    `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/delete`,
    `${supabaseUrl.replace(/\/$/, "")}/rpc/delete`,
  ];

  for (const endpoint of endpoints) {
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseSecretKey,
          Authorization: `Bearer ${supabaseSecretKey}`,
          "Accept-Profile": "pgmq_public",
          "Content-Profile": "pgmq_public",
        },
        body: JSON.stringify({
          queue_name: QUEUE_NAME,
          message_id: msgId,
        }),
        signal: AbortSignal.timeout(QUEUE_FETCH_TIMEOUT_MS),
      });

      if (resp.ok) {
        return;
      }
    } catch {
      // Try the next endpoint.
    }
  }

  console.warn(`[account-mailer] Failed to delete message ${msgId}`);
}

function sanitizeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return (err.message || "Failed to send email").slice(0, 500);
  }

  return "Failed to send email";
}

async function isRevertNotificationAlreadySent(
  admin: SupabaseClient,
  reversionId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("email_change_reversions")
    .select("notification_sent_at")
    .eq("id", reversionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load revert notification state: ${error.message}`);
  }

  return Boolean(data?.notification_sent_at);
}

async function processQueueMessage(
  admin: SupabaseClient,
  msg: QueueMessage,
): Promise<void> {
  const payload = msg.message;
  const msgId = msg.msg_id;
  const readCt = msg.read_ct;

  if (
    !payload.reversion_id ||
    !payload.old_email ||
    !payload.new_email ||
    !payload.raw_token ||
    !payload.expires_at
  ) {
    console.error("[account-mailer] Invalid queue payload. Deleting.");
    await deleteQueueMessage(msgId);
    return;
  }

  const expiresAt = Date.parse(payload.expires_at);
  if (!Number.isNaN(expiresAt) && expiresAt <= Date.now()) {
    await admin.rpc("mark_email_revert_notification_failed", {
      p_reversion_id: payload.reversion_id,
      p_error: "Notification expired before delivery",
    });
    console.error(
      `[account-mailer] Revert notification ${payload.reversion_id} expired. Deleting.`,
    );
    await deleteQueueMessage(msgId);
    return;
  }

  if (await isRevertNotificationAlreadySent(admin, payload.reversion_id)) {
    console.log(
      `[account-mailer] Revert notification ${payload.reversion_id} already sent. Deleting duplicate.`,
    );
    await deleteQueueMessage(msgId);
    return;
  }

  if (readCt > MAX_ATTEMPTS) {
    await admin.rpc("mark_email_revert_notification_failed", {
      p_reversion_id: payload.reversion_id,
      p_error: `Exceeded max delivery attempts (${MAX_ATTEMPTS})`,
    });
    console.error(
      `[account-mailer] Revert notification ${payload.reversion_id} exceeded max attempts. Deleting.`,
    );
    await deleteQueueMessage(msgId);
    return;
  }

  let sent = false;
  try {
    await sendRevertEmail(payload);
    sent = true;

    const { data: marked, error: markError } = await admin.rpc(
      "mark_email_revert_notification_sent",
      { p_reversion_id: payload.reversion_id },
    );

    if (markError) {
      throw new Error(`Failed to mark notification sent: ${markError.message}`);
    }

    if (!marked) {
      console.log(
        `[account-mailer] Revert notification ${payload.reversion_id} was already marked sent.`,
      );
    }

    await deleteQueueMessage(msgId);
    console.log(`[account-mailer] Sent revert notification ${payload.reversion_id}.`);
  } catch (err) {
    if (sent) {
      try {
        await admin.rpc("mark_email_revert_notification_sent", {
          p_reversion_id: payload.reversion_id,
        });
      } catch (markErr) {
        console.error(
          `[account-mailer] Sent revert notification ${payload.reversion_id} but failed to mark sent:`,
          markErr,
        );
      }
      await deleteQueueMessage(msgId);
      console.error(
        `[account-mailer] Revert notification ${payload.reversion_id} was sent; skipped retry after post-send failure.`,
      );
      return;
    }

    const message = sanitizeErrorMessage(err);
    await admin.rpc("mark_email_revert_notification_failed", {
      p_reversion_id: payload.reversion_id,
      p_error: message,
    });
    console.error(
      `[account-mailer] Failed to send revert notification ${payload.reversion_id} (attempt ${readCt}):`,
      message,
    );
  }
}

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
} | undefined;

Deno.serve(
  withAutomationSecret(async () => {
    try {
      getSiteUrl();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[account-mailer] Invalid mailer configuration:", message);
      return new Response(
        JSON.stringify({ error: "Mailer is not configured", details: message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const { supabaseUrl, supabaseSecretKey } = getSupabaseConfig();
    const admin = createClient(supabaseUrl, supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let messageList: QueueMessage[] = [];
    try {
      messageList = await readQueueMessages(
        QUEUE_NAME,
        VISIBILITY_TIMEOUT_SECONDS,
        1,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[account-mailer] Error reading from queue:", message);
      return new Response(
        JSON.stringify({ error: "Failed to read from queue", details: message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (messageList.length === 0) {
      return new Response(
        JSON.stringify({ status: "no_messages", message: "Queue is empty" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const processPromise = processQueueMessage(admin, messageList[0]).catch((err) => {
      console.error("[account-mailer] Background queue processing failed:", err);
    });

    if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
      EdgeRuntime.waitUntil(processPromise);
    }

    return new Response(JSON.stringify({ status: "accepted" }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  }),
);
