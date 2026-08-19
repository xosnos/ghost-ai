import { NextResponse } from "next/server";
import { executeEmailRevert } from "@/lib/account/email-revert";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { token?: string };
    const token = body.token?.trim();

    if (!token) {
      return NextResponse.json(
        { error: "This revert link is invalid or expired." },
        { status: 400 },
      );
    }

    await executeEmailRevert(token);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "This revert link is invalid or expired." }, { status: 400 });
  }
}
