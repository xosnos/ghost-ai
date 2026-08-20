"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthError } from "@/components/auth/auth-error";
import { AuthField } from "@/components/auth/auth-field";
import { Button } from "@/components/ui/button";

const RESEND_COOLDOWN_SECONDS = 60;

interface OtpVerificationStepProps {
  email: string;
  title: string;
  description: string;
  submitLabel: string;
  loading: boolean;
  error: string | null;
  onVerify: (token: string) => void;
  onResend: () => Promise<boolean>;
  onBack?: () => void;
}

export function OtpVerificationStep({
  email,
  title,
  description,
  submitLabel,
  loading,
  error,
  onVerify,
  onResend,
  onBack,
}: OtpVerificationStepProps) {
  const [token, setToken] = useState("");
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0 || resending) return;
    setResendError(null);
    setResending(true);
    try {
      const sent = await onResend();
      if (sent) {
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
      }
    } catch {
      setResendError("Could not resend the verification code.");
    } finally {
      setResending(false);
    }
  }, [onResend, resendCooldown, resending]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onVerify(token.trim());
  }

  function handleTokenChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
    setToken(digits);
  }

  function handleTokenPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    setToken(pasted);
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
        {title}
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        {description} <strong style={{ color: "var(--text-secondary)" }}>{email}</strong>.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="otp-code"
          label="6-digit code"
          type="text"
          inputMode="numeric"
          value={token}
          onChange={handleTokenChange}
          onPaste={handleTokenPaste}
          placeholder="000000"
          required
          autoComplete="one-time-code"
          minLength={6}
          maxLength={6}
        />

        <AuthError message={error ?? resendError} />

        <Button type="submit" className="w-full" disabled={loading || token.length !== 6}>
          {loading ? "Verifying..." : submitLabel}
        </Button>

        <div className="flex items-center justify-between gap-3 text-sm">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="hover:underline"
              style={{ color: "var(--text-muted)" }}
            >
              Back
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || resending}
            className="hover:underline disabled:opacity-50 disabled:no-underline"
            style={{ color: "var(--accent-primary)" }}
          >
            {resending
              ? "Sending..."
              : resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : "Resend code"}
          </button>
        </div>
      </form>
    </div>
  );
}
