"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AuthField } from "@/components/auth/auth-field";
import { AuthError } from "@/components/auth/auth-error";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

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
      <h1
        className="text-xl font-semibold mb-1"
        style={{ color: "var(--text-primary)" }}
      >
        Sign in
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Enter your credentials to access your workspace.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="login-email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />

        <AuthField
          id="login-password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          required
          autoComplete="current-password"
          labelExtra={
            <Link
              href="/forgot-password"
              className="text-xs hover:underline"
              style={{ color: "var(--accent-primary)" }}
            >
              Forgot password?
            </Link>
          }
        />

        <AuthError message={error} />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p
        className="mt-6 text-center text-sm"
        style={{ color: "var(--text-muted)" }}
      >
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="hover:underline"
          style={{ color: "var(--accent-primary)" }}
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
