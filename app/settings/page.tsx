import { redirect } from "next/navigation";

export default function SettingsPage() {
  redirect("/editor?settings=1");
}
