import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EditorChrome } from "@/components/editor/editor-chrome";

export default async function EditorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <EditorChrome userEmail={user.email ?? ""}>
      <div
        className="flex flex-1 items-center justify-center"
        style={{ color: "var(--text-faint)" }}
      >
        Canvas goes here
      </div>
    </EditorChrome>
  );
}
