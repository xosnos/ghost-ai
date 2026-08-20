import { AuthLayoutShell } from "@/components/auth/auth-layout-shell";

export default function AuthRouteLayout({ children }: { children: React.ReactNode }) {
  return <AuthLayoutShell>{children}</AuthLayoutShell>;
}
