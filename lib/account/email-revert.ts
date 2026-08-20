import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export interface EmailRevertPreview {
  oldEmail: string;
  newEmail: string;
}

export async function lookupEmailRevert(token: string): Promise<EmailRevertPreview | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("lookup_email_revert", {
    p_token: token,
  });

  if (error || !data) {
    return null;
  }

  const payload = data as { old_email?: string; new_email?: string };
  if (!payload.old_email || !payload.new_email) {
    return null;
  }

  return {
    oldEmail: payload.old_email,
    newEmail: payload.new_email,
  };
}

export async function executeEmailRevert(token: string): Promise<{
  userId: string;
  oldEmail: string;
}> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("execute_email_revert", {
    p_token: token,
  });

  if (error) {
    if (/invalid_token/i.test(error.message)) {
      throw new Error("invalid_token");
    }
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("invalid_token");
  }

  const payload = data as { user_id?: string; old_email?: string };
  if (!payload.user_id || !payload.old_email) {
    throw new Error("invalid_token");
  }

  return {
    userId: payload.user_id,
    oldEmail: payload.old_email,
  };
}
