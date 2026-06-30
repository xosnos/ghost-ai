import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { EditorChrome } from "@/components/editor/editor-chrome";

export default async function EditorPage() {
  const user = await getCurrentUser();

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
