import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AccessDenied() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{
          backgroundColor: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
        }}
      >
        <Lock className="h-7 w-7" style={{ color: "var(--text-muted)" }} />
      </div>
      <div className="flex flex-col gap-2">
        <h1
          className="text-xl font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Access denied
        </h1>
        <p className="max-w-sm text-sm" style={{ color: "var(--text-muted)" }}>
          You do not have permission to view this project, or it does not exist.
        </p>
      </div>
      <Button asChild variant="secondary">
        <Link href="/editor">Back to projects</Link>
      </Button>
    </div>
  );
}
