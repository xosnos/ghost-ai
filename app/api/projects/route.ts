import { NextResponse } from "next/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import {
  createProject,
  listOwnedProjects,
  errorResponse,
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
    return errorResponse(err);
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
    return errorResponse(err);
  }
}
