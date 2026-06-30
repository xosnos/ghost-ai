"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface UserMenuProps {
  email: string;
}

export function UserMenu({ email }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  async function handleSignOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Sign out failed:", error.message);
      return;
    }
    router.push("/login");
    router.refresh();
  }

  const initial = email.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors hover:opacity-80"
        style={{
          backgroundColor: "var(--accent-primary-dim)",
          color: "var(--accent-primary)",
          border: "1px solid var(--border-subtle)",
        }}
        aria-label="User menu"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {initial}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-56 rounded-xl p-1 shadow-lg"
          style={{
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
          }}
          role="menu"
        >
          <div className="px-3 py-2 mb-1" style={{ borderBottom: "1px solid var(--border-default)" }}>
            <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
              {email}
            </p>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-(--bg-subtle)"
            style={{ color: "var(--text-secondary)" }}
            role="menuitem"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
