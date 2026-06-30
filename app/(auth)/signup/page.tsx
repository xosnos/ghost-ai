"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AuthField } from "@/components/auth/auth-field";
import { AuthError } from "@/components/auth/auth-error";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/editor");
      router.refresh();
    } else {
      setCheckEmail(true);
      setLoading(false);
    }
  }

  if (checkEmail) {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Check your email
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          We sent a confirmation link to <strong style={{ color: "var(--text-secondary)" }}>{email}</strong>.
          Click the link in the email to activate your account.
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
        Create an account
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Get started with Ghost AI for free.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="signup-email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />

        <AuthField
          id="signup-password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Create a password (min. 6 characters)"
          required
          autoComplete="new-password"
          minLength={6}
        />

        <AuthError message={error} />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        Already have an account?{" "}
        <Link href="/login" className="hover:underline" style={{ color: "var(--accent-primary)" }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
