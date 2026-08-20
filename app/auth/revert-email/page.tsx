import { RevertEmailForm } from "@/components/auth/revert-email-form";
import { lookupEmailRevert } from "@/lib/account/email-revert";

interface RevertEmailPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function RevertEmailPage({ searchParams }: RevertEmailPageProps) {
  const params = await searchParams;
  const token = params.token?.trim();

  if (!token) {
    return <InvalidRevertMessage />;
  }

  const preview = await lookupEmailRevert(token);

  if (!preview) {
    return <InvalidRevertMessage />;
  }

  return <RevertEmailForm token={token} oldEmail={preview.oldEmail} newEmail={preview.newEmail} />;
}

function InvalidRevertMessage() {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        Link unavailable
      </h1>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        This revert link is invalid or has expired.
      </p>
    </div>
  );
}
