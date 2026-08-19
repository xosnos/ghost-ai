"use client";

import { useState } from "react";
import { AuthError } from "@/components/auth/auth-error";
import { Button } from "@/components/ui/button";

interface RevertEmailFormProps {
  token: string;
  oldEmail: string;
  newEmail: string;
}

export function RevertEmailForm({ token, oldEmail, newEmail }: RevertEmailFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/account/email/revert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    setLoading(false);

    if (!response.ok) {
      setError("This revert link is invalid or expired.");
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
          Email restored
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Your account email was restored to <strong>{oldEmail}</strong>. Sign in with that address
          to continue.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        Revert email change
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Restore your account email from <strong>{newEmail}</strong> back to{" "}
        <strong>{oldEmail}</strong>.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthError message={error} />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Reverting..." : "Revert email change"}
        </Button>
      </form>
    </div>
  );
}
