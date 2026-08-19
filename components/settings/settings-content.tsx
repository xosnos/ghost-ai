"use client";

import { AlertTriangle, Mail, Trash2, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthError } from "@/components/auth/auth-error";
import { OtpVerificationStep } from "@/components/auth/otp-verification-step";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { isValidEmail, normalizeEmail } from "@/lib/projects/collaborators";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface SettingsContentProps {
  currentEmail: string;
  displayName?: string | null;
}

type SettingsSection = "profile" | "email";

const SECTIONS: {
  id: SettingsSection;
  label: string;
  icon: typeof User;
}[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "email", label: "Email", icon: Mail },
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
    <nav className="flex flex-col gap-0.5" aria-label="Settings sections">
      {SECTIONS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;

        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
              isActive
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/70 hover:text-[var(--text-primary)]",
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

function SettingsCard({
  title,
  description,
  footer,
  footerTone = "default",
  children,
}: {
  title: string;
  description?: string;
  footer?: React.ReactNode;
  footerTone?: "default" | "danger";
  children?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
      <div className="px-5 py-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">{description}</p>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
      {footer ? (
        <div
          className={cn(
            "flex flex-col gap-3 border-t border-[var(--border-default)] px-5 py-3 sm:flex-row sm:items-center sm:justify-between",
            footerTone === "danger" && "bg-[var(--state-error)]/5",
          )}
        >
          {footer}
        </div>
      ) : null}
    </section>
  );
}

function SettingsRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-[var(--border-default)] py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-[var(--text-muted)]">{hint}</p> : null}
      </div>
      <div className="text-sm text-[var(--text-secondary)] sm:text-right">{value}</div>
    </div>
  );
}

export function SettingsContent({ currentEmail, displayName }: SettingsContentProps) {
  const router = useRouter();
  const normalizedCurrentEmail = normalizeEmail(currentEmail);
  const profileLabel = displayName?.trim() || currentEmail.split("@")[0] || "Account";
  const profileInitial = profileLabel.charAt(0).toUpperCase();

  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");

  const [newEmail, setNewEmail] = useState("");
  const [emailStep, setEmailStep] = useState<"form" | "otp">("form");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
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

  function resetDeleteDialog() {
    setDeleteDialogOpen(false);
    setDeleteEmailConfirm("");
    setDeleteStep("form");
    setDeleteError(null);
    setDeleteLoading(false);
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
    <>
      <div className="mb-8 space-y-1">
        <p className="text-sm text-[var(--text-muted)]">Manage your Architype account.</p>
      </div>

      <div className="flex flex-col gap-8 md:flex-row md:gap-10">
        <aside className="md:w-44 md:shrink-0">
          <SettingsNav active={activeSection} onChange={setActiveSection} />
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          {activeSection === "profile" ? (
            <>
              <SettingsCard title="Profile">
                <div className="flex items-center gap-4">
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
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {profileLabel}
                    </p>
                    <p className="truncate text-sm text-[var(--text-muted)]">{currentEmail}</p>
                  </div>
                </div>
              </SettingsCard>

              <SettingsCard
                title="Account details"
                description="Your signed-in identity across Architype projects and collaboration."
              >
                <SettingsRow
                  label="Email"
                  value={currentEmail}
                  hint="Used to sign in with a one-time code."
                />
                <SettingsRow
                  label="Display name"
                  value={displayName?.trim() || "Set at signup"}
                  hint="Shown to collaborators in shared projects."
                />
                <SettingsRow label="Sign-in method" value="Email one-time code" />
              </SettingsCard>

              <SettingsCard
                title="Delete account"
                description="Permanently delete your account, owned projects, canvases, and generated specs. This cannot be undone."
                footer={
                  <>
                    <p className="text-xs text-[var(--text-muted)]">
                      You will need to verify your email before deletion completes.
                    </p>
                    <Button
                      type="button"
                      variant="destructive"
                      className="rounded-lg"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete account
                    </Button>
                  </>
                }
                footerTone="danger"
              />
            </>
          ) : null}

          {activeSection === "email" ? (
            <SettingsCard
              title="Change email"
              description="We send a 6-digit code to your new inbox. Your previous inbox can revert the change for 7 days."
            >
              {emailSuccess ? (
                <p className="mb-4 rounded-lg border border-[var(--border-default)] bg-[var(--accent-primary-dim)] px-3 py-2.5 text-sm text-[var(--text-secondary)]">
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
                <form onSubmit={handleSendEmailChangeCode} className="max-w-md space-y-4">
                  <div>
                    <label
                      htmlFor="settings-current-email"
                      className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
                    >
                      Current email
                    </label>
                    <Input
                      id="settings-current-email"
                      type="email"
                      value={currentEmail}
                      readOnly
                      className="bg-[var(--bg-elevated)]/60"
                    />
                  </div>
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
                  <Button type="submit" disabled={emailLoading} className="rounded-lg">
                    {emailLoading ? "Sending code..." : "Send confirmation code"}
                  </Button>
                </form>
              )}
            </SettingsCard>
          ) : null}
        </div>
      </div>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetDeleteDialog();
            return;
          }
          setDeleteDialogOpen(true);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[var(--state-error)]" />
              Delete account
            </DialogTitle>
            <DialogDescription>
              This will permanently delete your account and all owned projects. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>

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
                  className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
                >
                  Type your current email to continue
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
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-lg"
                  onClick={resetDeleteDialog}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleteLoading}
                  className="rounded-lg"
                  onClick={handleSendDeleteOtp}
                >
                  {deleteLoading ? "Sending code..." : "Send verification code"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
