"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { UserMenu } from "@/components/editor/user-menu";

interface SettingsShellProps {
  userEmail: string;
  children: React.ReactNode;
}

export function SettingsShell({ userEmail, children }: SettingsShellProps) {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/editor"
            className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to editor
          </Link>

          <h1 className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-[var(--text-primary)]">
            Settings
          </h1>

          <UserMenu email={userEmail} />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
