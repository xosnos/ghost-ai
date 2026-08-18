import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatSpecDate(isoDateString?: string): string {
  if (!isoDateString) return "";
  try {
    const date = new Date(isoDateString);
    if (Number.isNaN(date.getTime())) return isoDateString;
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    });
  } catch {
    return isoDateString;
  }
}

export function formatMessageTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return timestamp;
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
  } catch {
    return timestamp;
  }
}

export function projectSlug(name: string, id: string): string {
  const base = slugify(name);
  const suffix = id.replace(/-/g, "").slice(0, 6);
  if (!base && !suffix) return "untitled";
  if (!base) return suffix;
  if (!suffix) return base;
  return `${base}-${suffix}`;
}
