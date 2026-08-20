import { NextResponse } from "next/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: user.email,
    options: { shouldCreateUser: false },
  });

  if (error) {
    console.error("[account/delete/otp]", error.message);
    return NextResponse.json({ error: "Could not send a verification code." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
