"use client";

import React, { useState, useMemo } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Inline token types
type InlineToken =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "bold_italic"; text: string }
  | { type: "inline_code"; text: string }
  | { type: "strikethrough"; text: string }
  | { type: "link"; text: string; href: string };

function parseInlineTokens(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let remaining = text;

  // Matches:
  // 1: `code` -> [1, 2]
  // 3: ***bold-italic*** -> [3, 4]
  // 5: **bold** -> [5, 6]
  // 7: *italic* -> [7, 8]
  // 9: ~~strike~~ -> [9, 10]
  // 11: [text](url) -> [11, 12, 13]
  const pattern =
    /(`([^`]+)`)|(\*\*\*([^*]+)\*\*\*)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(~~([^~]+)~~)|(\[([^\]]+)\]\(([^)]+)\))/;

  while (remaining.length > 0) {
    const match = pattern.exec(remaining);
    if (!match) {
      tokens.push({ type: "text", text: remaining });
      break;
    }

    const matchIndex = match.index;
    if (matchIndex > 0) {
      tokens.push({ type: "text", text: remaining.slice(0, matchIndex) });
    }

    if (match[2]) {
      tokens.push({ type: "inline_code", text: match[2] });
    } else if (match[4]) {
      tokens.push({ type: "bold_italic", text: match[4] });
    } else if (match[6]) {
      tokens.push({ type: "bold", text: match[6] });
    } else if (match[8]) {
      tokens.push({ type: "italic", text: match[8] });
    } else if (match[10]) {
      tokens.push({ type: "strikethrough", text: match[10] });
    } else if (match[12] && match[13]) {
      tokens.push({
        type: "link",
        text: match[12],
        href: match[13],
      });
    } else {
      tokens.push({ type: "text", text: match[0] });
    }

    remaining = remaining.slice(matchIndex + match[0].length);
  }

  return tokens;
}

function renderInlineTokens(tokens: InlineToken[], keyPrefix = ""): React.ReactNode[] {
  return tokens.map((token, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (token.type) {
      case "bold_italic":
        return (
          <strong key={key} className="font-bold italic text-[var(--text-primary)]">
            {token.text}
          </strong>
        );
      case "bold":
        return (
          <strong key={key} className="font-semibold text-[var(--text-primary)]">
            {token.text}
          </strong>
        );
      case "italic":
        return (
          <em key={key} className="italic text-[var(--text-secondary)]">
            {token.text}
          </em>
        );
      case "inline_code":
        return (
          <code
            key={key}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[var(--accent-ai-text)]"
          >
            {token.text}
          </code>
        );
      case "strikethrough":
        return (
          <del key={key} className="line-through text-[var(--text-muted)]">
            {token.text}
          </del>
        );
      case "link":
        return (
          <a
            key={key}
            href={token.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent-primary)] underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            {token.text}
          </a>
        );
      case "text":
      default:
        return <React.Fragment key={key}>{token.text}</React.Fragment>;
    }
  });
}

function CodeBlock({
  language,
  code,
}: {
  language: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  return (
    <div className="relative my-4 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] shadow-sm">
      <div className="flex h-8 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 px-3.5 text-xs text-[var(--text-muted)]">
        <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-[var(--state-success)]" />
              <span className="text-[var(--state-success)]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-3.5">
        <pre className="font-mono text-[12px] leading-relaxed text-[var(--text-primary)] whitespace-pre">
          {code}
        </pre>
      </div>
    </div>
  );
}

interface BlockItem {
  type:
    | "heading"
    | "code_block"
    | "table"
    | "blockquote"
    | "unordered_list"
    | "ordered_list"
    | "divider"
    | "paragraph";
  level?: number;
  language?: string;
  code?: string;
  headers?: string[];
  rows?: string[][];
  items?: string[];
  text?: string;
}

function parseMarkdownBlocks(markdown: string): BlockItem[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: BlockItem[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced Code block
    if (line.trim().startsWith("```")) {
      const language = line.trim().replace(/^```/, "").trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      // skip closing ```
      i++;
      blocks.push({
        type: "code_block",
        language,
        code: codeLines.join("\n"),
      });
      continue;
    }

    // Horizontal Rule
    if (/^(---|___|\*\*\*)\s*$/.test(line.trim())) {
      blocks.push({ type: "divider" });
      i++;
      continue;
    }

    // Headings (#, ##, ###, etc.)
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      blocks.push({ type: "heading", level, text });
      i++;
      continue;
    }

    // Blockquote (> text)
    if (line.trim().startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({
        type: "blockquote",
        text: quoteLines.join("\n"),
      });
      continue;
    }

    // Table detection: line with pipes (|) followed by separator line (|---|---|)
    if (
      line.trim().startsWith("|") &&
      i + 1 < lines.length &&
      lines[i + 1].trim().startsWith("|") &&
      lines[i + 1].includes("---")
    ) {
      const parseRow = (rowStr: string) =>
        rowStr
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((cell) => cell.trim());

      const headers = parseRow(line);
      i += 2; // skip header and separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(parseRow(lines[i]));
        i++;
      }
      blocks.push({
        type: "table",
        headers,
        rows,
      });
      continue;
    }

    // Unordered List (- item or * item)
    if (/^(\s*)[-*+]\s+(.*)$/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^(\s*)[-*+]\s+(.*)$/.test(lines[i])) {
        const itemMatch = /^(\s*)[-*+]\s+(.*)$/.exec(lines[i]);
        if (itemMatch) {
          items.push(itemMatch[2]);
        }
        i++;
      }
      blocks.push({
        type: "unordered_list",
        items,
      });
      continue;
    }

    // Ordered List (1. item)
    if (/^(\s*)\d+\.\s+(.*)$/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^(\s*)\d+\.\s+(.*)$/.test(lines[i])) {
        const itemMatch = /^(\s*)\d+\.\s+(.*)$/.exec(lines[i]);
        if (itemMatch) {
          items.push(itemMatch[2]);
        }
        i++;
      }
      blocks.push({
        type: "ordered_list",
        items,
      });
      continue;
    }

    // Blank line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Paragraph
    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith(">") &&
      !/^(---|___|\*\*\*)\s*$/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith("|") &&
      !/^(\s*)[-*+]\s+/.test(lines[i]) &&
      !/^(\s*)\d+\.\s+/.test(lines[i])
    ) {
      paragraphLines.push(lines[i]);
      i++;
    }
    blocks.push({
      type: "paragraph",
      text: paragraphLines.join(" "),
    });
  }

  return blocks;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const blocks = useMemo(() => parseMarkdownBlocks(content || ""), [content]);

  return (
    <div className={cn("flex flex-col text-sm text-[var(--text-primary)] leading-relaxed space-y-3", className)}>
      {blocks.map((block, idx) => {
        const blockKey = `block-${idx}`;

        switch (block.type) {
          case "heading": {
            const headingTokens = parseInlineTokens(block.text || "");
            const renderedText = renderInlineTokens(headingTokens, blockKey);
            if (block.level === 1) {
              return (
                <h1
                  key={blockKey}
                  className="text-xl font-bold tracking-tight text-[var(--text-primary)] mt-5 mb-2 pb-2 border-b border-[var(--border-default)] first:mt-0"
                >
                  {renderedText}
                </h1>
              );
            }
            if (block.level === 2) {
              return (
                <h2
                  key={blockKey}
                  className="text-base font-semibold tracking-tight text-[var(--text-primary)] mt-4 mb-2 pb-1.5 border-b border-[var(--border-subtle)] first:mt-0"
                >
                  {renderedText}
                </h2>
              );
            }
            if (block.level === 3) {
              return (
                <h3
                  key={blockKey}
                  className="text-sm font-semibold text-[var(--text-primary)] mt-3 mb-1.5 first:mt-0"
                >
                  {renderedText}
                </h3>
              );
            }
            return (
              <h4
                key={blockKey}
                className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mt-2 mb-1"
              >
                {renderedText}
              </h4>
            );
          }

          case "code_block":
            return (
              <CodeBlock
                key={blockKey}
                language={block.language || ""}
                code={block.code || ""}
              />
            );

          case "blockquote": {
            const tokens = parseInlineTokens(block.text || "");
            return (
              <blockquote
                key={blockKey}
                className="my-2.5 rounded-r-xl border-l-4 border-[var(--accent-primary)] bg-[var(--bg-subtle)]/70 py-2.5 px-3.5 italic text-[var(--text-secondary)] text-xs"
              >
                {renderInlineTokens(tokens, blockKey)}
              </blockquote>
            );
          }

          case "table":
            return (
              <div
                key={blockKey}
                className="my-3.5 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-sm"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    {block.headers && block.headers.length > 0 && (
                      <thead className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)]/80 text-[var(--text-primary)] font-semibold">
                        <tr>
                          {block.headers.map((hdr, hIdx) => (
                            <th key={`th-${hIdx}`} className="py-2 px-3 border-r border-[var(--border-subtle)] last:border-r-0">
                              {renderInlineTokens(parseInlineTokens(hdr), `${blockKey}-th-${hIdx}`)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                    )}
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {(block.rows || []).map((row, rIdx) => (
                        <tr
                          key={`tr-${rIdx}`}
                          className={cn(
                            "transition-colors hover:bg-[var(--bg-subtle)]/40",
                            rIdx % 2 === 1 && "bg-[var(--bg-subtle)]/20"
                          )}
                        >
                          {row.map((cell, cIdx) => (
                            <td
                              key={`td-${rIdx}-${cIdx}`}
                              className="py-2 px-3 text-[var(--text-secondary)] border-r border-[var(--border-subtle)] last:border-r-0"
                            >
                              {renderInlineTokens(parseInlineTokens(cell), `${blockKey}-r${rIdx}-c${cIdx}`)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );

          case "unordered_list":
            return (
              <ul key={blockKey} className="my-2 space-y-1.5 pl-4 list-disc marker:text-[var(--accent-primary)] text-xs text-[var(--text-primary)]">
                {(block.items || []).map((item, iIdx) => (
                  <li key={`ul-${iIdx}`} className="leading-relaxed">
                    {renderInlineTokens(parseInlineTokens(item), `${blockKey}-li-${iIdx}`)}
                  </li>
                ))}
              </ul>
            );

          case "ordered_list":
            return (
              <ol key={blockKey} className="my-2 space-y-1.5 pl-4 list-decimal marker:text-[var(--text-muted)] text-xs text-[var(--text-primary)]">
                {(block.items || []).map((item, iIdx) => (
                  <li key={`ol-${iIdx}`} className="leading-relaxed">
                    {renderInlineTokens(parseInlineTokens(item), `${blockKey}-oli-${iIdx}`)}
                  </li>
                ))}
              </ol>
            );

          case "divider":
            return (
              <hr key={blockKey} className="my-4 border-t border-[var(--border-default)]" />
            );

          case "paragraph":
          default: {
            const tokens = parseInlineTokens(block.text || "");
            return (
              <p key={blockKey} className="text-xs leading-relaxed text-[var(--text-primary)]">
                {renderInlineTokens(tokens, blockKey)}
              </p>
            );
          }
        }
      })}
    </div>
  );
}
