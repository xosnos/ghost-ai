import { redirect } from "next/navigation";
import { EditorChrome } from "@/components/editor/editor-chrome";
import { EditorHome } from "@/components/editor/editor-home";
import { listOwnedProjects, listSharedProjects } from "@/lib/projects/queries";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

interface EditorPageProps {
  searchParams: Promise<{ settings?: string }>;
}

export default async function EditorPage({ searchParams }: EditorPageProps) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const params = await searchParams;

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
      displayName={
        typeof user.user_metadata?.display_name === "string"
          ? user.user_metadata.display_name
          : null
      }
      currentUserId={user.id}
      ownedProjects={ownedProjects}
      sharedProjects={sharedProjects}
      openSettingsInitially={params.settings === "1"}
    >
      <EditorHome />
    </EditorChrome>
  );
}
