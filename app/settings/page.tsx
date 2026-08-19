import { redirect } from "next/navigation";
import { EditorChrome } from "@/components/editor/editor-chrome";
import { SettingsContent } from "@/components/settings/settings-content";
import { listOwnedProjects, listSharedProjects } from "@/lib/projects/queries";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export default async function SettingsPage() {
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
      <SettingsContent
        currentEmail={user.email ?? ""}
        displayName={
          typeof user.user_metadata?.display_name === "string"
            ? user.user_metadata.display_name
            : null
        }
      />
    </EditorChrome>
  );
}
