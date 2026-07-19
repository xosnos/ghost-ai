import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { EditorChrome } from "@/components/editor/editor-chrome";
import { EditorHome } from "@/components/editor/editor-home";

export default async function EditorPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <EditorChrome userEmail={user.email ?? ""}>
      <EditorHome />
    </EditorChrome>
  );
}
