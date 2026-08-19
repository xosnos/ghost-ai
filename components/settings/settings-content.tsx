"use client";

import { AlertTriangle, Mail, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthError } from "@/components/auth/auth-error";
import { OtpVerificationStep } from "@/components/auth/otp-verification-step";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isValidEmail, normalizeEmail } from "@/lib/projects/collaborators";
import { createClient } from "@/lib/supabase/client";

interface SettingsContentProps {
  currentEmail: string;
}

function mapAuthError(message: string): string {
  if (/already registered|already exists|already been registered/i.test(message)) {
    return "That email cannot be used.";
  }
  if (/rate limit|too many/i.test(message)) {
    return "Too many requests. Please wait a moment and try again.";
  }
  if (/expired|invalid/i.test(message)) {
    return "That code is invalid or expired. Request a new code and try again.";
  }
  return message;
}

export function SettingsContent({ currentEmail }: SettingsContentProps) {
  const router = useRouter();
  const normalizedCurrentEmail = normalizeEmail(currentEmail);

  const [newEmail, setNewEmail] = useState("");
  const [emailStep, setEmailStep] = useState<"form" | "otp">("form");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  const [deleteEmailConfirm, setDeleteEmailConfirm] = useState("");
  const [deleteStep, setDeleteStep] = useState<"form" | "otp">("form");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleSendEmailChangeCode(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);

    const trimmed = normalizeEmail(newEmail);
    if (!isValidEmail(trimmed)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    if (trimmed === normalizedCurrentEmail) {
      setEmailError("Enter a different email address.");
      return;
    }

    setEmailLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email: trimmed });
    setEmailLoading(false);

    if (error) {
      setEmailError(mapAuthError(error.message));
      return;
    }

    setEmailStep("otp");
  }

  async function handleVerifyEmailChange(token: string) {
    setEmailError(null);
    setEmailLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: normalizeEmail(newEmail),
      token,
      type: "email_change",
    });
    setEmailLoading(false);

    if (error) {
      setEmailError(mapAuthError(error.message));
      return;
    }

    setEmailStep("form");
    setNewEmail("");
    setEmailSuccess(
      "Your email was updated. Your previous inbox can revert this change for 7 days.",
    );
    router.refresh();
  }

  async function resendEmailChangeCode(): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      email: normalizeEmail(newEmail),
    });
    if (error) {
      setEmailError(mapAuthError(error.message));
      return false;
    }
    setEmailError(null);
    return true;
  }

  async function handleSendDeleteOtp() {
    setDeleteError(null);

    if (normalizeEmail(deleteEmailConfirm) !== normalizedCurrentEmail) {
      setDeleteError("Type your current email exactly to continue.");
      return;
    }

    setDeleteLoading(true);
    const response = await fetch("/api/account/delete/otp", { method: "POST" });
    setDeleteLoading(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setDeleteError(body?.error ?? "Could not send a verification code.");
      return;
    }

    setDeleteStep("otp");
  }

  async function handleVerifyDelete(token: string) {
    setDeleteError(null);
    setDeleteLoading(true);

    const response = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: normalizedCurrentEmail,
        token,
      }),
    });
    setDeleteLoading(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setDeleteError(body?.error ?? "Could not delete your account.");
      return;
    }

    router.push("/login");
    router.refresh();
  }

  async function resendDeleteOtp(): Promise<boolean> {
    const response = await fetch("/api/account/delete/otp", { method: "POST" });
    if (!response.ok) {
      setDeleteError("Could not resend the verification code.");
      return false;
    }
    setDeleteError(null);
    return true;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Settings
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Manage your account email and deletion options.
        </p>
      </div>

      <Card className="border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
        <div className="mb-4 flex items-center gap-2">
          <Mail className="h-4 w-4 text-[var(--accent-primary)]" />
          <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
            Profile
          </h2>
        </div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Current email
        </p>
        <p className="mt-1 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          {currentEmail}
        </p>
      </Card>

      <Card className="border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
        <h2 className="text-lg font-medium mb-1" style={{ color: "var(--text-primary)" }}>
          Change email
        </h2>
        <p className="mb-4 text-sm" style={{ color: "var(--text-muted)" }}>
          We will send a 6-digit code to your new inbox. Your old inbox can revert the change for 7
          days.
        </p>

        {emailSuccess ? (
          <p
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            {emailSuccess}
          </p>
        ) : null}

        {emailStep === "otp" ? (
          <OtpVerificationStep
            email={normalizeEmail(newEmail)}
            title="Confirm your new email"
            description="Enter the 6-digit code we sent to"
            submitLabel="Confirm new email"
            loading={emailLoading}
            error={emailError}
            onVerify={handleVerifyEmailChange}
            onResend={resendEmailChangeCode}
            onBack={() => {
              setEmailStep("form");
              setEmailError(null);
            }}
          />
        ) : (
          <form onSubmit={handleSendEmailChangeCode} className="space-y-4">
            <div>
              <label
                htmlFor="settings-new-email"
                className="mb-1.5 block text-xs font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                New email
              </label>
              <Input
                id="settings-new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
            <AuthError message={emailError} />
            <Button type="submit" disabled={emailLoading}>
              {emailLoading ? "Sending code..." : "Send confirmation code"}
            </Button>
          </form>
        )}
      </Card>

      <Card className="border-[var(--state-error)]/30 bg-[var(--bg-surface)] p-6">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[var(--state-error)]" />
          <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
            Delete account
          </h2>
        </div>
        <p className="mb-4 text-sm" style={{ color: "var(--text-muted)" }}>
          Permanently delete your account, owned projects, canvases, and generated specs. This
          cannot be undone.
        </p>

        {deleteStep === "otp" ? (
          <OtpVerificationStep
            email={currentEmail}
            title="Confirm account deletion"
            description="Enter the 6-digit code we sent to"
            submitLabel="Delete my account"
            loading={deleteLoading}
            error={deleteError}
            onVerify={handleVerifyDelete}
            onResend={resendDeleteOtp}
            onBack={() => {
              setDeleteStep("form");
              setDeleteError(null);
            }}
          />
        ) : (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="settings-delete-email"
                className="mb-1.5 block text-xs font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Type your current email to confirm
              </label>
              <Input
                id="settings-delete-email"
                type="email"
                value={deleteEmailConfirm}
                onChange={(e) => setDeleteEmailConfirm(e.target.value)}
                placeholder={currentEmail}
                required
                autoComplete="off"
              />
            </div>
            <AuthError message={deleteError} />
            <Button
              type="button"
              variant="destructive"
              disabled={deleteLoading}
              onClick={handleSendDeleteOtp}
            >
              <Trash2 className="h-4 w-4" />
              {deleteLoading ? "Sending code..." : "Send verification code"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
