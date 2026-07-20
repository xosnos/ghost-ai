import { clsx, type ClassValue } from "clsx";
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

export function projectSlug(name: string, id: string): string {
  const base = slugify(name);
  const suffix = id.replace(/-/g, "").slice(0, 6);
  if (!base && !suffix) return "untitled";
  if (!base) return suffix;
  if (!suffix) return base;
  return `${base}-${suffix}`;
}
