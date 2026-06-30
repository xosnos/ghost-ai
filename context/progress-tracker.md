# Progress Tracker

Update this file whenever the current phase, active feature, or implementation state changes.

## Current Phase

- Feature 03: Auth

## Current Goal

- Implement authentication per 03-auth.md.

## Completed

- Boilerplate cleanup (globals.css, page.tsx, public SVGs)
- 01-design-system: globals.css tokens, lib/utils.ts cn() helper, shadcn/ui components (Button, Card, Dialog, Input, Tabs, Textarea, ScrollArea), lucide-react, Radix UI primitives
- 02-editor-chrome: EditorNavbar (fixed top bar, sidebar toggle, PanelLeftOpen/Close), ProjectSidebar (floating overlay, slides in from left, My Projects / Shared tabs, New Project button)

## In Progress

- None.

## Next Up

- 03-auth

## Open Questions

- None yet.

## Architecture Decisions

- Tailwind v4 CSS-first config — design tokens defined as CSS custom properties in globals.css, mapped to Tailwind via @theme inline.
- shadcn/ui components authored directly (no CLI); live in components/ui/.
- ProjectSidebar is a fixed overlay (does not push page content) positioned below the navbar.

## Session Notes

- All shadcn components use var(--token) inline styles rather than Tailwind aliases, since @theme inline maps are defined but Tailwind v4 utility generation from CSS vars requires the exact variable names.
