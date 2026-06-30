"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Check your email
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          We sent a password reset link to <strong style={{ color: "var(--text-secondary)" }}>{email}</strong>.
          Click the link in the email to reset your password.
        </p>
        <Link href="/login">
          <Button variant="ghost" className="w-full">
            Back to sign in
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
        Reset your password
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="forgot-email" className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Email
          </label>
          <Input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>

        {error && (
          <p className="text-xs" style={{ color: "var(--state-error)" }}>
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Sending link..." : "Send reset link"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        Remember your password?{" "}
        <Link href="/login" className="hover:underline" style={{ color: "var(--accent-primary)" }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
