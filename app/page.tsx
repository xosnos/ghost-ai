import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function Home() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/editor");
  } else {
    redirect("/login");
  }
}
