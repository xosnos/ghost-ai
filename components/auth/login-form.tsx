"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthError } from "@/components/auth/auth-error";
import { AuthField } from "@/components/auth/auth-field";
import { OtpVerificationStep } from "@/components/auth/otp-verification-step";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

function mapAuthError(message: string): string {
  if (/rate limit|too many/i.test(message)) {
    return "Too many requests. Please wait a moment and try again.";
  }
  if (/expired|invalid/i.test(message)) {
    return "That code is invalid or expired. Request a new code and try again.";
  }
  return message;
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function sendOtp(targetEmail: string): Promise<boolean> {
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: targetEmail.trim(),
      options: { shouldCreateUser: false },
    });

    if (otpError) {
      setError("We could not send a sign-in code. Check the address or sign up.");
      return false;
    }

    setError(null);
    return true;
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const sent = await sendOtp(email);
    setLoading(false);

    if (sent) {
      setStep("otp");
    }
  }

  async function handleVerify(token: string) {
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    });

    if (verifyError) {
      setError(mapAuthError(verifyError.message));
      setLoading(false);
      return;
    }

    router.refresh();
    router.push("/editor");
  }

  if (step === "otp") {
    return (
      <OtpVerificationStep
        email={email.trim()}
        title="Enter your sign-in code"
        description="We sent a 6-digit code to"
        submitLabel="Sign in"
        loading={loading}
        error={error}
        onVerify={handleVerify}
        onResend={() => sendOtp(email)}
        onBack={() => {
          setStep("email");
          setError(null);
        }}
      />
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
        Sign in
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Enter your email and we will send you a one-time sign-in code.
      </p>

      <form onSubmit={handleEmailSubmit} className="space-y-4">
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

        <AuthError message={error} />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Sending code..." : "Send sign-in code"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="hover:underline" style={{ color: "var(--accent-primary)" }}>
          Sign up
        </Link>
      </p>
    </div>
  );
}
