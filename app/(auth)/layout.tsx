import { Cpu } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div
        className="hidden lg:flex lg:w-[480px] flex-col justify-center px-16"
        style={{ backgroundColor: "var(--bg-surface)", borderRight: "1px solid var(--border-default)" }}
      >
        <div className="flex items-center gap-2 mb-8">
          <Cpu className="h-6 w-6" style={{ color: "var(--accent-primary)" }} />
          <span className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Ghost AI
          </span>
        </div>

        <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
          Collaborative system design powered by AI. Describe your architecture in plain English and watch it come to life.
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

      <div className="flex flex-1 items-center justify-center p-6" style={{ backgroundColor: "var(--bg-base)" }}>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
