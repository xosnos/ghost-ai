import { NextResponse } from "next/server";
import { executeEmailRevert } from "@/lib/account/email-revert";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { token?: string } | null;
    const token = body?.token?.trim();

    if (!token) {
      return NextResponse.json(
        { error: "This revert link is invalid or expired." },
        { status: 400 },
      );
    }

    await executeEmailRevert(token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_token") {
      return NextResponse.json(
        { error: "This revert link is invalid or expired." },
        { status: 400 },
      );
    }

    console.error("[account] email revert failed:", error);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
