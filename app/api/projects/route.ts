import { NextResponse } from "next/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import {
  createProject,
  listOwnedProjects,
} from "@/lib/projects/queries";

export async function GET() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projects = await listOwnedProjects(supabase, user.id);
    return NextResponse.json({ projects });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const rawName = typeof body.name === "string" ? body.name : "";
  const name = rawName.trim() || "Untitled Project";

  try {
    const project = await createProject(supabase, { ownerId: user.id, name });
    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
