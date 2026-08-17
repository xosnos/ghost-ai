"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Sparkles,
  Send,
  FileText,
  Download,
  ArrowUpRight,
  ShoppingCart,
  MessageSquare,
  GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GhostLogo } from "@/components/ui/ghost-logo";
import { cn } from "@/lib/utils";

interface AiSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const STARTER_PROMPTS = [
  {
    title: "Design an e-commerce backend",
    icon: ShoppingCart,
    color: "bg-cyan-500/15 border-cyan-500/30 text-cyan-600 dark:text-cyan-400",
  },
  {
    title: "Create a chat app architecture",
    icon: MessageSquare,
    color: "bg-purple-500/15 border-purple-500/30 text-purple-600 dark:text-purple-400",
  },
  {
    title: "Build a CI/CD pipeline",
    icon: GitBranch,
    color: "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
  },
];

export function AiSidebar({ isOpen, onClose }: AiSidebarProps) {
  const [activeTab, setActiveTab] = useState<"architect" | "specs">("architect");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        Math.max(textareaRef.current.scrollHeight, 72),
        160
      )}px`;
    }
  };

  const handleSendMessage = (textToSend?: string) => {
    const content = (textToSend ?? input).trim();
    if (!content) return;

    const userMessage: ChatMessage = {
      id: `msg-${crypto.randomUUID()}`,
      role: "user",
      content,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "72px";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Backdrop for mobile drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed top-0 bottom-0 right-0 z-50 flex h-screen w-80 lg:w-96 flex-col shadow-2xl backdrop-blur-md transition-transform duration-200 ease-out border-l",
          "bg-[var(--bg-surface)] border-[var(--border-default)]"
        )}
        style={{
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          visibility: isOpen ? "visible" : "hidden",
        }}
        aria-label="AI Workspace Sidebar"
        aria-hidden={!isOpen}
        inert={!isOpen ? true : undefined}
      >
        {/* Header - Matches Editor Chrome & Project Sidebar */}
        <div className="flex h-12 shrink-0 items-center justify-between px-4 border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2.5">
            <GhostLogo size="xs" variant="mark" glow />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                AI Workspace
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">
                Collaborate with Ghost AI
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close AI sidebar"
            className="h-7 w-7 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Top Segmented Controls - Google Stitch Sliding Pill Style */}
        <div className="p-3 pb-2 bg-[var(--bg-surface)]">
          <div className="relative grid grid-cols-2 items-center rounded-xl bg-[var(--bg-subtle)] p-1 border border-[var(--border-default)]">
            {/* Animated Slider Pill */}
            <div
              className="absolute left-1 top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-[var(--bg-surface)] shadow-sm border border-[var(--border-subtle)] transition-transform duration-200 ease-out pointer-events-none"
              style={{
                transform: activeTab === "architect" ? "translateX(0)" : "translateX(100%)",
              }}
            />

            <button
              type="button"
              onClick={() => setActiveTab("architect")}
              className={cn(
                "relative z-10 flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors duration-200 whitespace-nowrap",
                activeTab === "architect"
                  ? "text-[var(--text-primary)] font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--accent-ai-text)]" />
              <span>AI Architect</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("specs")}
              className={cn(
                "relative z-10 flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors duration-200 whitespace-nowrap",
                activeTab === "specs"
                  ? "text-[var(--text-primary)] font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" />
              <span>Specs</span>
            </button>
          </div>
        </div>

        {/* Content View */}
        <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg-surface)]">
          {activeTab === "architect" ? (
            /* AI Architect Chat Tab */
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Scrollable Chat Area */}
              <ScrollArea className="flex-1 px-4 py-3">
                {messages.length === 0 ? (
                  /* Empty State */
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="mb-3">
                      <GhostLogo size={36} variant="mark" glow className="shadow-lg" />
                    </div>
                    <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                      Design with AI Architect
                    </h4>
                    <p className="text-xs text-[var(--text-muted)] max-w-[260px] mb-5 leading-relaxed">
                      Describe a system or ask Ghost AI to generate canvas architectures, refine components, or generate specifications.
                    </p>

                    {/* Starter Prompt Chips */}
                    <div className="flex flex-col gap-1.5 w-full max-w-[300px]">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)] text-left px-1">
                        Starter Ideas
                      </span>
                      {STARTER_PROMPTS.map((prompt) => {
                        const Icon = prompt.icon;
                        return (
                          <button
                            key={prompt.title}
                            type="button"
                            onClick={() => handleSendMessage(prompt.title)}
                            className="group flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-all bg-[var(--bg-subtle)]/70 hover:bg-[var(--bg-elevated)] border border-[var(--border-default)]/70 hover:border-[var(--border-default)]"
                          >
                            <div
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                                prompt.color
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <span className="truncate text-xs font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors flex-1">
                              {prompt.title}
                            </span>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-faint)] opacity-0 transition-opacity group-hover:opacity-100 group-hover:text-[var(--text-secondary)]" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Chat Messages List */
                  <div className="flex flex-col gap-3 py-2">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex flex-col gap-1 max-w-[85%]",
                          msg.role === "user" ? "self-end items-end" : "self-start items-start"
                        )}
                      >
                        <div
                          className={cn(
                            "rounded-2xl p-3 text-xs leading-relaxed shadow-sm break-words",
                            msg.role === "user"
                              ? "bg-[var(--accent-primary-dim)] border-2 border-[var(--accent-primary)]/50 text-[var(--text-primary)] rounded-tr-sm"
                              : "bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--accent-ai-text)] rounded-tl-sm"
                          )}
                        >
                          {msg.content}
                        </div>
                        <span className="text-[10px] text-[var(--text-faint)] px-1">
                          {msg.timestamp}
                        </span>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Chat Input Area */}
              <div className="p-3 border-t border-[var(--border-default)] bg-[var(--bg-surface)]">
                <div className="relative flex flex-col rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2.5 transition-colors focus-within:border-[var(--accent-primary)]/50 focus-within:ring-1 focus-within:ring-[var(--accent-primary)]/30 shadow-sm">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe a system architecture..."
                    rows={1}
                    className="w-full resize-none bg-transparent px-1 py-1 text-xs text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none min-h-[72px] max-h-[160px] leading-relaxed"
                    style={{
                      color: "var(--text-primary)",
                      caretColor: "var(--accent-primary)",
                    }}
                  />

                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border-default)]/60">
                    <span className="text-[10px] text-[var(--text-faint)]">
                      Enter to send, Shift+Enter for newline
                    </span>
                    <Button
                      size="icon"
                      onClick={() => handleSendMessage()}
                      disabled={!input.trim()}
                      className="h-7 w-7 rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 disabled:opacity-30 active:scale-95 transition-all shadow-sm"
                      aria-label="Send prompt"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Specs Tab */
            <div className="flex flex-1 flex-col overflow-hidden p-4">
              <div className="flex flex-col gap-4">
                <Button
                  type="button"
                  disabled
                  className="w-full gap-2 rounded-xl bg-[var(--accent-primary)] text-white font-medium hover:bg-[var(--accent-primary)]/90 h-9 text-xs shadow-sm active:scale-[0.98] transition-all"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate Spec
                </Button>

                {/* Demo Spec Card */}
                <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]">
                        <FileText className="h-4 w-4 text-[var(--accent-primary)]" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-[var(--text-primary)]">
                          System Architecture Spec
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          v1.0 • Generated preview
                        </span>
                      </div>
                    </div>
                    <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      PREVIEW
                    </span>
                  </div>

                  {/* Snippet Preview */}
                  <div className="rounded-xl bg-[var(--bg-base)] p-3 border border-[var(--border-subtle)]/60">
                    <pre className="text-[11px] font-mono text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
{`# System Architecture Specification

## 1. Overview
High-throughput distributed backend.

## 2. Components
- API Gateway & Load Balancer
- Auth & Session Service
- Postgres Primary / Replica
- Redis Cache Cluster`}
                    </pre>
                  </div>

                  {/* Disabled Download Action */}
                  <Button
                    variant="secondary"
                    disabled
                    className="w-full gap-2 text-xs rounded-xl h-8 border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-muted)] opacity-60 cursor-not-allowed"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Markdown (Demo)
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
