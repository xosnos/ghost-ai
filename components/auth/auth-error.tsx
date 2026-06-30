interface AuthErrorProps {
  message: string | null;
}

export function AuthError({ message }: AuthErrorProps) {
  if (!message) return null;

  return (
    <p className="text-xs" style={{ color: "var(--state-error)" }}>
      {message}
    </p>
  );
}
