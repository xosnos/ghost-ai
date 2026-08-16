"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Plus,
  ArrowUp,
  Mic,
  Monitor,
  Zap,
  Cloud,
  ChevronDown,
  Check,
  X,
  Wand2,
  Loader2,
  FileText,
  Globe,
  LayoutTemplate,
  Sun,
  Moon,
} from "lucide-react";
import { useProjectDialogs } from "@/components/editor/project-dialog-context";
import { useTheme } from "@/lib/theme-provider";
import { cn } from "@/lib/utils";

const PROMPT_SUGGESTIONS = [
  {
    label: "Event-Driven Payment Gateway",
    prompt:
      "High-throughput Event-Driven Payment Gateway with Kafka message broker, distributed idempotency cache on Redis, isolated Payment and Auth microservices, and Postgres database replicas.",
  },
  {
    label: "Multi-tenant SaaS Platform",
    prompt:
      "Multi-tenant SaaS Architecture with Postgres Row-Level Security (RLS), Supabase Auth, Cloudflare Edge API gateway, and Stripe webhook subscription billing pipeline.",
  },
  {
    label: "Real-time AI Canvas Engine",
    prompt:
      "Real-time Collaborative Whiteboard & AI Canvas engine with WebSocket server cluster, Redis Pub/Sub state sync, async AI inference task queue, and vector database retrieval.",
  },
  {
    label: "Video Transcoding Pipeline",
    prompt:
      "Scalable Video Streaming & Transcoding Pipeline using AWS S3 upload buckets, SQS job queues, GPU worker nodes, and CloudFront global CDN distribution.",
  },
];

const MODELS = [
  { id: "gemini-2.5-flash", name: "3.0 Flash", provider: "Gemini" },
  { id: "claude-3-7-sonnet", name: "Claude 3.7", provider: "Anthropic" },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI" },
];

export function EditorHome() {
  const router = useRouter();
  const { openCreate } = useProjectDialogs();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [prompt, setPrompt] = useState(
    "Create a high-throughput payment and subscription system with Redis caching, Kafka event streaming, and partitioned PostgreSQL storage."
  );
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [activeArchMode, setActiveArchMode] = useState<"microservices" | "serverless">("microservices");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; size: string }[]>([]);
  const [attachedUrl, setAttachedUrl] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setAttachMenuOpen(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSubmitPrompt() {
    if (!prompt.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Derive a clean name from the prompt
      const words = prompt.trim().split(/\s+/).slice(0, 5).join(" ");
      const projectName = words.length > 30 ? words.slice(0, 27) + "..." : words;

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectName || "New System Design" }),
      });

      if (!res.ok) {
        throw new Error("Failed to create project");
      }

      const data = await res.json();
      if (data.project?.id) {
        router.push(`/editor/${data.project.id}`);
      } else {
        openCreate();
      }
    } catch (err) {
      console.error("Error creating project from prompt:", err);
      openCreate();
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEnhancePrompt() {
    setAttachMenuOpen(false);
    if (!prompt.trim()) {
      setPrompt(
        "Design a distributed real-time messaging architecture with WebSockets, Redis pub/sub cluster, Apache Kafka for audit logging, and partitioned PostgreSQL storage."
      );
      return;
    }
    setPrompt(
      (prev) =>
        `${prev.trim()}\n\nRequirements: Include API Gateway routing, rate-limiting, JWT authentication, dedicated worker pools, and automated database backups.`
    );
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: { name: string; size: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const sizeKb = Math.round(file.size / 1024);
      newAttachments.push({
        name: file.name,
        size: sizeKb > 1000 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`,
      });
    }

    setAttachedFiles((prev) => [...prev, ...newAttachments]);
    setAttachMenuOpen(false);
  }

  function handleAddUrlPrompt() {
    setAttachMenuOpen(false);
    const url = window.prompt("Enter documentation or GitHub repository URL:");
    if (url && url.trim()) {
      setAttachedUrl(url.trim());
    }
  }

  return (
    <div className="relative flex flex-1 flex-col items-center justify-between min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 bg-dot-grid overflow-y-auto">
      {/* Hidden file input for attachments */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Top Banner - Google Stitch Style */}
      {!bannerDismissed && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300 mb-6 flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)]/90 px-3.5 py-1 text-xs text-[var(--text-secondary)] shadow-sm backdrop-blur-md hover:border-[var(--border-subtle)]">
          <Sparkles className="h-3.5 w-3.5 text-[var(--accent-ai-text)]" />
          <span className="font-medium">Meet the new Ghost AI Architect</span>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            aria-label="Dismiss banner"
            className="ml-1 rounded-full p-0.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Center Hero Content */}
      <div className="flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 my-auto">
        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[var(--text-primary)]">
            Welcome to Ghost AI..
          </h1>
        </div>

        {/* Suggestion Chips - Google Stitch Style */}
        <div className="flex w-full flex-wrap items-center justify-center gap-2">
          {PROMPT_SUGGESTIONS.map((sugg) => (
            <button
              key={sugg.label}
              type="button"
              onClick={() => {
                setPrompt(sugg.prompt);
                textareaRef.current?.focus();
              }}
              className="group flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)]/80 px-3.5 py-1.5 text-xs text-[var(--text-secondary)] backdrop-blur-sm transition-all hover:border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            >
              <span className="truncate max-w-[240px] sm:max-w-[280px]">
                {sugg.label}
              </span>
            </button>
          ))}
        </div>

        {/* Main Google Stitch-style Interactive Prompt Card */}
        <div className="relative w-full rounded-2xl md:rounded-3xl border border-[var(--border-default)] bg-[var(--bg-surface)]/90 p-3.5 sm:p-5 shadow-2xl backdrop-blur-xl transition-all focus-within:border-[var(--border-subtle)] focus-within:shadow-[0_0_40px_rgba(0,200,212,0.08)]">
          {/* Active Attachments Preview Pills */}
          {(attachedFiles.length > 0 || attachedUrl) && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {attachedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs text-[var(--text-secondary)] shadow-sm"
                >
                  <FileText className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                  <span className="truncate max-w-[160px]">{file.name}</span>
                  <span className="text-[10px] text-[var(--text-faint)]">({file.size})</span>
                  <button
                    type="button"
                    onClick={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
                    className="ml-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {attachedUrl && (
                <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs text-[var(--text-secondary)] shadow-sm">
                  <Globe className="h-3.5 w-3.5 text-[var(--accent-ai-text)]" />
                  <span className="truncate max-w-[200px]">{attachedUrl}</span>
                  <button
                    type="button"
                    onClick={() => setAttachedUrl(null)}
                    className="ml-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Text Area */}
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmitPrompt();
              }
            }}
            placeholder={
              activeArchMode === "microservices"
                ? "Describe your microservices architecture... (e.g. API Gateway, Auth Service, Orders Service, Kafka broker, and dedicated Postgres DBs)"
                : "Describe your serverless cloud architecture... (e.g. Cloudflare Workers, Edge Auth, Supabase Postgres, and S3 object storage)"
            }
            rows={4}
            style={{ color: "var(--text-primary)", caretColor: "var(--accent-primary)" }}
            className="w-full resize-none bg-transparent text-sm sm:text-base text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none leading-relaxed"
          />

          {/* Bottom Controls inside the Prompt Card */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-default)]/60">
            {/* Left toolbar */}
            <div className="flex items-center gap-2">
              {/* Attach Popover Menu - Matching Google Stitch Screenshot */}
              <div className="relative" ref={attachMenuRef}>
                <button
                  type="button"
                  onClick={() => setAttachMenuOpen((v) => !v)}
                  aria-label="Add attachments"
                  aria-expanded={attachMenuOpen}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                    attachMenuOpen
                      ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] ring-1 ring-[var(--accent-primary)]/40"
                      : "text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                  )}
                >
                  <Plus className="h-4 w-4" />
                </button>

                {attachMenuOpen && (
                  <div className="absolute left-0 bottom-full mb-2 w-56 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1.5 shadow-2xl backdrop-blur-xl z-40 animate-in fade-in slide-in-from-bottom-2 duration-150">
                    <button
                      type="button"
                      onClick={() => {
                        fileInputRef.current?.click();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <FileText className="h-4 w-4 text-[var(--accent-primary)]" />
                      <span>Upload Files</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAddUrlPrompt}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <Globe className="h-4 w-4 text-[var(--accent-ai-text)]" />
                      <span>Website URL</span>
                    </button>

                    <div className="my-1 border-t border-[var(--border-default)]" />

                    <button
                      type="button"
                      onClick={() => {
                        setAttachMenuOpen(false);
                        openCreate();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <LayoutTemplate className="h-4 w-4 text-[var(--text-muted)]" />
                      <span>Starter Templates</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleEnhancePrompt}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--accent-ai-text)] transition-colors"
                    >
                      <Sparkles className="h-4 w-4 text-[var(--accent-ai-text)]" />
                      <span>Enhance prompt</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Architecture Mode Toggle (Microservices / Serverless) with Smooth Slider Pill */}
              <div className="relative flex items-center rounded-lg bg-[var(--bg-base)] p-0.5 border border-[var(--border-default)]">
                {/* Animated Slider Pill */}
                <div
                  className="absolute left-0.5 top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md bg-[var(--bg-elevated)] shadow-sm border border-[var(--border-subtle)]/50 transition-transform duration-200 ease-out pointer-events-none"
                  style={{
                    transform: activeArchMode === "microservices" ? "translateX(0)" : "translateX(100%)",
                  }}
                />

                <button
                  type="button"
                  onClick={() => setActiveArchMode("microservices")}
                  className={cn(
                    "relative z-10 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-200",
                    activeArchMode === "microservices"
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  <span>Microservices</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveArchMode("serverless")}
                  className={cn(
                    "relative z-10 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-200",
                    activeArchMode === "serverless"
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  <Cloud className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Serverless</span>
                </button>
              </div>
            </div>

            {/* Right toolbar */}
            <div className="flex items-center gap-2">
              {/* Prompt Enhancer Button */}
              <button
                type="button"
                onClick={handleEnhancePrompt}
                title="Enhance prompt with technical details"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--accent-ai-text)] transition-colors"
              >
                <Wand2 className="h-4 w-4" />
              </button>

              {/* Model Selector Dropdown - Google Stitch Style */}
              <div className="relative" ref={modelMenuRef}>
                <button
                  type="button"
                  onClick={() => setModelDropdownOpen((v) => !v)}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-base)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-subtle)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <Sparkles className="h-3 w-3 text-[var(--accent-ai-text)]" />
                  <span>{selectedModel.name}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>

                {modelDropdownOpen && (
                  <div className="absolute right-0 bottom-full mb-2 w-48 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1 shadow-xl z-30">
                    <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                      AI Model
                    </div>
                    {MODELS.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          setSelectedModel(model);
                          setModelDropdownOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{model.name}</span>
                          <span className="text-[10px] text-[var(--text-faint)]">
                            {model.provider}
                          </span>
                        </div>
                        {selectedModel.id === model.id && (
                          <Check className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Voice / Mic Icon */}
              <button
                type="button"
                title="Voice input"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Mic className="h-4 w-4" />
              </button>

              {/* Circular Action / Submit Button - Google Stitch Style */}
              <button
                type="button"
                onClick={handleSubmitPrompt}
                disabled={!prompt.trim() || isSubmitting}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-all",
                  prompt.trim()
                    ? "bg-[var(--accent-primary)] text-black hover:scale-105 shadow-md active:scale-95"
                    : "bg-[var(--bg-elevated)] text-[var(--text-muted)] opacity-50 cursor-not-allowed"
                )}
                aria-label="Generate Architecture"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Right Theme Switcher - Google Stitch Style */}
      <div className="w-full flex justify-end pt-4" ref={themeMenuRef}>
        <div className="relative">
          <button
            type="button"
            onClick={() => setThemeMenuOpen((v) => !v)}
            title="Switch Theme"
            aria-label="Switch Theme"
            aria-expanded={themeMenuOpen}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] shadow-md backdrop-blur-md transition-all hover:border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]",
              themeMenuOpen && "border-[var(--accent-primary)]/50 text-[var(--text-primary)] ring-1 ring-[var(--accent-primary)]/30"
            )}
          >
            {theme === "system" ? (
              <Monitor className="h-4 w-4" />
            ) : resolvedTheme === "light" ? (
              <Sun className="h-4 w-4 text-amber-500" />
            ) : (
              <Moon className="h-4 w-4 text-indigo-400" />
            )}
          </button>

          {themeMenuOpen && (
            <div className="absolute right-0 bottom-full mb-2 w-44 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1.5 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <button
                type="button"
                onClick={() => {
                  setTheme("light");
                  setThemeMenuOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                  theme === "light"
                    ? "bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Sun className="h-4 w-4 text-amber-500" />
                  <span>Light</span>
                </div>
                {theme === "light" && (
                  <Check className="h-4 w-4 text-[var(--accent-primary)]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setTheme("system");
                  setThemeMenuOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                  theme === "system"
                    ? "bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Monitor className="h-4 w-4" />
                  <span>System</span>
                </div>
                {theme === "system" && (
                  <Check className="h-4 w-4 text-[var(--accent-primary)]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setTheme("dark");
                  setThemeMenuOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                  theme === "dark"
                    ? "bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Moon className="h-4 w-4 text-indigo-400" />
                  <span>Dark</span>
                </div>
                {theme === "dark" && (
                  <Check className="h-4 w-4 text-[var(--accent-primary)]" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


