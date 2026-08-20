import { NextResponse } from "next/server";
import { deleteAccountForUser } from "@/lib/account/delete-account";
import { normalizeEmail } from "@/lib/projects/collaborators";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    email?: string;
    token?: string;
  } | null;
  const typedEmail = body?.email?.trim();
  const token = body?.token?.trim();

  if (!typedEmail || !token) {
    return NextResponse.json({ error: "Email and code are required." }, { status: 400 });
  }

  if (normalizeEmail(typedEmail) !== normalizeEmail(user.email)) {
    return NextResponse.json(
      { error: "The confirmation email does not match your account." },
      { status: 400 },
    );
  }

  const { error: verifyError } = await supabase.auth.verifyOtp({
    email: user.email,
    token,
    type: "email",
  });

  if (verifyError) {
    return NextResponse.json(
      { error: "That code is invalid or expired. Request a new code and try again." },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminClient();
    await deleteAccountForUser(admin, user.id, user.email);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not delete account.";
    console.error("[account/delete]", message);
    return NextResponse.json({ error: "Could not delete your account." }, { status: 500 });
  }

  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch (err) {
    console.error("[account/delete] sign-out after deletion failed", err);
  }

  return NextResponse.json({ ok: true });
}
