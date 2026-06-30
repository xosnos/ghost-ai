"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AuthField } from "@/components/auth/auth-field";
import { AuthError } from "@/components/auth/auth-error";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/editor");
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
        Set a new password
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Enter your new password below.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="reset-password"
          label="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter new password (min. 6 characters)"
          required
          autoComplete="new-password"
          minLength={6}
        />

        <AuthField
          id="reset-confirm-password"
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          required
          autoComplete="new-password"
          minLength={6}
        />

        <AuthError message={error} />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Updating password..." : "Update password"}
        </Button>
      </form>
    </div>
  );
}
