"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthError } from "@/components/auth/auth-error";
import { AuthField } from "@/components/auth/auth-field";
import { OtpVerificationStep } from "@/components/auth/otp-verification-step";
import { Button } from "@/components/ui/button";
import { mapAuthError } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/client";

function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 80) {
    return "Display name must be between 1 and 80 characters.";
  }
  return null;
}

export function SignupForm() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"details" | "otp">("details");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function sendOtp(): Promise<boolean> {
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        data: { display_name: displayName.trim() },
      },
    });

    if (otpError) {
      setError(mapAuthError(otpError.message));
      return false;
    }

    setError(null);
    return true;
  }

  async function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const nameError = validateDisplayName(displayName);
    if (nameError) {
      setError(nameError);
      return;
    }

    setLoading(true);
    try {
      const sent = await sendOtp();
      if (sent) {
        setStep("otp");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(token: string) {
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: "email",
      });

      if (verifyError) {
        setError(mapAuthError(verifyError.message));
        return;
      }

      router.refresh();
      router.push("/editor");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "otp") {
    return (
      <OtpVerificationStep
        email={email.trim()}
        title="Verify your email"
        description="We sent a 6-digit code to"
        submitLabel="Create account"
        loading={loading}
        error={error}
        onVerify={handleVerify}
        onResend={sendOtp}
        onBack={() => {
          setStep("details");
          setError(null);
        }}
      />
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
        Create an account
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Get started with Architype for free.
      </p>

      <form onSubmit={handleDetailsSubmit} className="space-y-4">
        <AuthField
          id="signup-display-name"
          label="Display name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name"
          required
          autoComplete="name"
          maxLength={80}
        />

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

        <AuthError message={error} />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Sending code..." : "Continue"}
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
