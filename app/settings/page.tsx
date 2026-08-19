import { redirect } from "next/navigation";
import { SettingsContent } from "@/components/settings/settings-content";
import { SettingsShell } from "@/components/settings/settings-shell";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    redirect("/login");
  }

  return (
    <SettingsShell userEmail={user.email ?? ""}>
      <SettingsContent
        currentEmail={user.email ?? ""}
        displayName={
          typeof user.user_metadata?.display_name === "string"
            ? user.user_metadata.display_name
            : null
        }
      />
    </SettingsShell>
  );
}
