import { redirect } from "next/navigation";
import { EditorChrome } from "@/components/editor/editor-chrome";
import { EditorHome } from "@/components/editor/editor-home";
import { listOwnedProjects, listSharedProjects } from "@/lib/projects/queries";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export default async function EditorPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const [ownedProjects, sharedProjects] = await Promise.all([
    listOwnedProjects(supabase, user.id),
    listSharedProjects(supabase, user.email ?? ""),
  ]);

  return (
    <EditorChrome
      userEmail={user.email ?? ""}
      currentUserId={user.id}
      ownedProjects={ownedProjects}
      sharedProjects={sharedProjects}
    >
      <EditorHome />
    </EditorChrome>
  );
}
