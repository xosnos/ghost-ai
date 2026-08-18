import { ArchitypeLogo } from "@/components/ui/architype-logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div
        className="hidden lg:flex lg:w-[480px] flex-col justify-center px-16"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderRight: "1px solid var(--border-default)",
        }}
      >
        <div className="mb-8">
          <ArchitypeLogo size="lg" variant="full" glow />
        </div>

        <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
          Collaborative system design powered by AI. Describe your architecture in plain English and
          watch it come to life.
        </p>

        <ul className="space-y-3">
          {[
            "Real-time collaborative canvas",
            "AI-generated system architectures",
            "Export to technical specifications",
            "Starter templates for common patterns",
          ].map((feature) => (
            <li
              key={feature}
              className="text-sm flex items-start gap-2"
              style={{ color: "var(--text-muted)" }}
            >
              <span style={{ color: "var(--accent-primary)" }}>&#8226;</span>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <div
        className="flex flex-1 flex-col items-center justify-center p-6"
        style={{ backgroundColor: "var(--bg-base)" }}
      >
        {/* Mobile Header Branding */}
        <div className="lg:hidden mb-8">
          <ArchitypeLogo size="md" variant="full" glow />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
