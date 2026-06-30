# Progress Tracker

Update this file whenever the current phase, active feature, or implementation state changes.

## Current Phase

- Feature 03: Auth (complete)

## Current Goal

- Next feature spec.

## Completed

- Boilerplate cleanup (globals.css, page.tsx, public SVGs)
- 01-design-system: globals.css tokens, lib/utils.ts cn() helper, shadcn/ui components (Button, Card, Dialog, Input, Tabs, Textarea, ScrollArea), lucide-react, Radix UI primitives
- 02-editor-chrome: EditorNavbar (fixed top bar, sidebar toggle, PanelLeftOpen/Close), ProjectSidebar (floating overlay, slides in from left, My Projects / Shared tabs, New Project button)
- 03-auth: Supabase Auth integration — sign-in, sign-up, forgot-password, reset-password pages with two-panel layout; middleware route protection; auth callback handler; UserMenu component in editor navbar; root page redirect logic

## In Progress

- None.

## Next Up

- 04-project-dialogs

## Open Questions

- None yet.

## Architecture Decisions

- Tailwind v4 CSS-first config — design tokens defined as CSS custom properties in globals.css, mapped to Tailwind via @theme inline.
- shadcn/ui components authored directly (no CLI); live in components/ui/.
- ProjectSidebar is a fixed overlay (does not push page content) positioned below the navbar.
- Auth uses Supabase Auth (not Clerk). Cookie-based sessions via @supabase/ssr. Middleware at project root handles session refresh and route protection. Public routes: /login, /signup, /forgot-password, /reset-password, /auth/callback.
- Editor page at /editor is a server component that fetches user then renders client EditorChrome with userEmail prop.

## Session Notes

- All shadcn components use var(--token) inline styles rather than Tailwind aliases, since @theme inline maps are defined but Tailwind v4 utility generation from CSS vars requires the exact variable names.
- Supabase Auth email confirmation is OFF by default in the provisioned instance. This is intentional for the current development phase. The signup flow handles both cases gracefully (immediate session or "check your email" state). Before implementing the collaborator-by-email sharing feature (spec 09), email confirmation should be re-evaluated to prevent users from claiming collaborator access with unverified emails.
