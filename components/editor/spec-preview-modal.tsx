"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import {
  FileText,
  Download,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import type { ProjectSpecDetail } from "@/types/specs";
import { formatSpecDate } from "@/lib/utils";

interface SpecPreviewModalProps {
  open: boolean;
  spec: ProjectSpecDetail | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  onDownload: () => void;
  onClose: () => void;
}

export function SpecPreviewModal({
  open,
  spec,
  loading,
  error,
  onRetry,
  onDownload,
  onClose,
}: SpecPreviewModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyMarkdown = async () => {
    if (!spec?.content) return;
    try {
      await navigator.clipboard.writeText(spec.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write error
    }
  };

  const lineCount = spec?.content ? spec.content.split("\n").length : 0;
  const wordCount = spec?.content
    ? spec.content.trim().split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl sm:max-w-4xl h-[min(88dvh,820px)] flex flex-col p-0 gap-0 overflow-hidden border-[var(--border-default)] bg-[var(--bg-surface)] rounded-3xl shadow-2xl">
        {/* Modal Header */}
        <DialogHeader className="flex flex-row items-center justify-between px-6 py-4 border-b border-[var(--border-default)] bg-[var(--bg-surface)] shrink-0 pr-14">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary-dim)] border border-[var(--accent-primary)]/30 text-[var(--accent-primary)]">
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-semibold text-[var(--text-primary)] truncate">
                  {spec?.fileName || "Specification Document"}
                </DialogTitle>
                <span className="shrink-0 rounded-full border border-[var(--accent-primary)]/30 bg-[var(--accent-primary-dim)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--accent-primary)]">
                  MARKDOWN
                </span>
              </div>
              <DialogDescription className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                {spec?.createdAt ? (
                  <span>Generated {formatSpecDate(spec.createdAt)}</span>
                ) : (
                  <span>Technical System Specification</span>
                )}
              </DialogDescription>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {spec && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyMarkdown}
                  className="h-8 gap-1.5 rounded-xl border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-[var(--state-success)]" />
                      <span className="text-[var(--state-success)]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={onDownload}
                  className="h-8 gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3 text-xs text-white hover:bg-[var(--accent-primary)]/90 transition-colors shadow-sm cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </Button>
              </>
            )}
          </div>
        </DialogHeader>

        {/* Modal Body / Markdown Content */}
        <div className="flex-1 min-h-0 relative bg-[var(--bg-base)]">
          {loading ? (
            /* Loading State */
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  Loading specification...
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  Fetching markdown content from server
                </span>
              </div>
            </div>
          ) : error ? (
            /* Error State */
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--state-error)]/10 text-[var(--state-error)] border border-[var(--state-error)]/20">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="flex flex-col gap-1 max-w-sm">
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  Failed to load specification
                </span>
                <span className="text-xs text-[var(--text-muted)] leading-relaxed">
                  {error}
                </span>
              </div>
              {onRetry && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="mt-2 gap-1.5 rounded-xl border-[var(--border-default)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </Button>
              )}
            </div>
          ) : spec?.content ? (
            /* Markdown Rendered Content */
            <ScrollArea className="h-full px-6 py-6 sm:px-8">
              <div className="max-w-3xl mx-auto">
                <MarkdownRenderer content={spec.content} />
              </div>
            </ScrollArea>
          ) : (
            /* Empty / No Content */
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-[var(--text-muted)]">
              <FileText className="h-8 w-8 opacity-40" />
              <span className="text-xs">No specification content available.</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--border-default)] bg-[var(--bg-surface)] shrink-0 text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-3">
            {spec && (
              <>
                <span>{lineCount} lines</span>
                <span>•</span>
                <span>{wordCount} words</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 rounded-xl border-[var(--border-default)] bg-[var(--bg-surface)] px-4 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Close
            </Button>
            {spec && (
              <Button
                type="button"
                size="sm"
                onClick={onDownload}
                className="h-8 gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 text-xs text-white hover:bg-[var(--accent-primary)]/90 cursor-pointer shadow-sm"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
