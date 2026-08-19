"use client";

import { AlertTriangle, Mail, Shield, Trash2, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthError } from "@/components/auth/auth-error";
import { OtpVerificationStep } from "@/components/auth/otp-verification-step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidEmail, normalizeEmail } from "@/lib/projects/collaborators";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface SettingsContentProps {
  currentEmail: string;
  displayName?: string | null;
}

type SettingsSection = "account" | "email" | "delete";

const SECTIONS: {
  id: SettingsSection;
  label: string;
  icon: typeof User;
}[] = [
  { id: "account", label: "Account", icon: User },
  { id: "email", label: "Email", icon: Mail },
  { id: "delete", label: "Delete account", icon: Trash2 },
];

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

function SettingsNav({
  active,
  onChange,
}: {
  active: SettingsSection;
  onChange: (section: SettingsSection) => void;
}) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Settings sections">
      {SECTIONS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        const isDanger = id === "delete";

        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all",
              isActive
                ? isDanger
                  ? "bg-[var(--state-error)]/10 text-[var(--state-error)] ring-1 ring-[var(--state-error)]/20"
                  : "bg-[var(--accent-primary-dim)] text-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]/20"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

function SectionHeader({
  title,
  description,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  description: string;
  icon: typeof User;
  tone?: "default" | "danger";
}) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-2">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-xl",
            tone === "danger"
              ? "bg-[var(--state-error)]/10 text-[var(--state-error)]"
              : "bg-[var(--accent-primary-dim)] text-[var(--accent-primary)]",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
      </div>
      <p className="text-sm leading-relaxed text-[var(--text-muted)]">{description}</p>
    </div>
  );
}

export function SettingsContent({ currentEmail, displayName }: SettingsContentProps) {
  const router = useRouter();
  const normalizedCurrentEmail = normalizeEmail(currentEmail);
  const profileLabel = displayName?.trim() || currentEmail.split("@")[0] || "Account";
  const profileInitial = profileLabel.charAt(0).toUpperCase();

  const [activeSection, setActiveSection] = useState<SettingsSection>("account");

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
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-dot-grid p-4 sm:p-6 md:p-8">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-faint)]">
            Account
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Settings
          </h1>
          <p className="max-w-2xl text-sm text-[var(--text-muted)]">
            Manage your Architype account, email, and workspace ownership.
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:gap-6">
          <aside className="md:w-52 md:shrink-0">
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)]/80 p-2 shadow-sm backdrop-blur-md md:sticky md:top-0">
              <SettingsNav active={activeSection} onChange={setActiveSection} />
            </div>
          </aside>

          <div className="min-h-0 flex-1">
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)]/90 p-5 shadow-2xl backdrop-blur-xl sm:rounded-3xl sm:p-6 md:p-8">
              {activeSection === "account" ? (
                <section>
                  <SectionHeader
                    title="Account"
                    description="Your signed-in identity across Architype projects, collaboration, and AI chat."
                    icon={User}
                  />

                  <div className="flex items-center gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)]/70 px-4 py-4">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                      style={{
                        backgroundColor: "var(--accent-primary-dim)",
                        color: "var(--accent-primary)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      {profileInitial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {profileLabel}
                      </p>
                      <p className="truncate text-sm text-[var(--text-muted)]">{currentEmail}</p>
                    </div>
                    <div className="hidden items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--text-faint)] sm:flex">
                      <Shield className="h-3 w-3" />
                      Verified
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)]/40 px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
                        Sign-in method
                      </p>
                      <p className="mt-1 text-sm font-medium text-[var(--text-secondary)]">
                        Email one-time code
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)]/40 px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
                        Display name
                      </p>
                      <p className="mt-1 text-sm font-medium text-[var(--text-secondary)]">
                        {displayName?.trim() || "Set at signup"}
                      </p>
                    </div>
                  </div>
                </section>
              ) : null}

              {activeSection === "email" ? (
                <section>
                  <SectionHeader
                    title="Change email"
                    description="We send a 6-digit code to your new inbox. Your previous inbox can revert the change for 7 days."
                    icon={Mail}
                  />

                  {emailSuccess ? (
                    <p className="mb-4 rounded-xl border border-[var(--border-default)] bg-[var(--accent-primary-dim)] px-3 py-2.5 text-sm text-[var(--text-secondary)]">
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
                    <form onSubmit={handleSendEmailChangeCode} className="space-y-4 max-w-md">
                      <div>
                        <label
                          htmlFor="settings-new-email"
                          className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
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
                          className="bg-[var(--bg-base)]/50"
                        />
                      </div>
                      <AuthError message={emailError} />
                      <Button type="submit" disabled={emailLoading} className="rounded-xl">
                        {emailLoading ? "Sending code..." : "Send confirmation code"}
                      </Button>
                    </form>
                  )}
                </section>
              ) : null}

              {activeSection === "delete" ? (
                <section>
                  <SectionHeader
                    title="Delete account"
                    description="Permanently delete your account, owned projects, canvases, and generated specs. This cannot be undone."
                    icon={AlertTriangle}
                    tone="danger"
                  />

                  <div className="rounded-2xl border border-[var(--state-error)]/25 bg-[var(--state-error)]/5 p-4 sm:p-5">
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
                      <div className="space-y-4 max-w-md">
                        <div>
                          <label
                            htmlFor="settings-delete-email"
                            className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
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
                            className="bg-[var(--bg-base)]/50"
                          />
                        </div>
                        <AuthError message={deleteError} />
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={deleteLoading}
                          onClick={handleSendDeleteOtp}
                          className="rounded-xl"
                        >
                          <Trash2 className="h-4 w-4" />
                          {deleteLoading ? "Sending code..." : "Send verification code"}
                        </Button>
                      </div>
                    )}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
