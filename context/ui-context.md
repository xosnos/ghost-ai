# UI Context

## Theme

Supports both Dark mode (default) and Google Stitch-style Clean Light mode.

All colors are defined as CSS custom properties in `globals.css` and mapped to Tailwind tokens via `@theme inline`. Components use these tokens rather than hardcoded hex values.

| Role             | CSS Variable           | Dark Mode Value           | Light Mode Value          |
| ---------------- | ---------------------- | ------------------------- | ------------------------- |
| Page background  | `--bg-base`            | `#080809`                 | `#f9fafb`                 |
| Surface          | `--bg-surface`         | `#111114`                 | `#ffffff`                 |
| Elevated surface | `--bg-elevated`        | `#18181c`                 | `#f3f4f6`                 |
| Subtle surface   | `--bg-subtle`          | `#1e1e23`                 | `#e5e7eb`                 |
| Default border   | `--border-default`     | `#2a2a30`                 | `#e5e7eb`                 |
| Subtle border    | `--border-subtle`      | `#3a3a42`                 | `#d1d5db`                 |
| Primary text     | `--text-primary`       | `#f0f0f4`                 | `#111827`                 |
| Secondary text   | `--text-secondary`     | `#c0c0cc`                 | `#374151`                 |
| Muted text       | `--text-muted`         | `#808090`                 | `#6b7280`                 |
| Faint text       | `--text-faint`         | `#505060`                 | `#9ca3af`                 |
| Brand accent     | `--accent-primary`     | `#00c8d4` (cyan)          | `#0096a6`                 |
| Brand dim        | `--accent-primary-dim` | `rgba(0, 200, 212, 0.12)` | `rgba(0, 150, 166, 0.12)` |
| AI accent        | `--accent-ai`          | `#6457f9` (indigo-purple) | `#5046e5`                 |
| AI text          | `--accent-ai-text`     | `#8b82ff`                 | `#6366f1`                 |
| Error            | `--state-error`        | `#ff4d4f`                 | `#ef4444`                 |
| Success          | `--state-success`      | `#34d399`                 | `#10b981`                 |
| Warning          | `--state-warning`      | `#fbbf24`                 | `#f59e0b`                 |

Tailwind utility names map to these variables. Use `bg-base`, `bg-surface`, `text-copy-primary`, `text-copy-muted`, `border-surface-border`, `text-brand`, `bg-accent-dim`, etc.

## Typography

| Role      | Font       | CSS Variable        |
| --------- | ---------- | ------------------- |
| UI text   | Geist Sans | `--font-geist-sans` |
| Code/mono | Geist Mono | `--font-geist-mono` |

Both fonts are loaded via `next/font/google` and applied as CSS variables on the `<html>` element. The base `body` uses Geist Sans with `antialiased`.

## Border Radius

Radius increases with surface depth — smaller for inner elements, larger for outer containers.

| Context           | Class         |
| ----------------- | ------------- |
| Inline / small UI | `rounded-xl`  |
| Cards / panels    | `rounded-2xl` |
| Modal / overlay   | `rounded-3xl` |

## Canvas

### Node Color Palette

8 defined color pairs with theme-adaptive tokens. In Dark mode, nodes use deep fills with neon text; in Light mode, nodes adapt to soft pastel fills with high-contrast saturated text and subtle matching borders. Resolved at runtime via `resolveNodeColor(color, resolvedTheme)`.

| Name      | Dark Fill | Dark Text | Light Fill | Light Text | Light Border |
| --------- | --------- | --------- | ---------- | ---------- | ------------ |
| Neutral   | `#1F1F1F` | `#EDEDED` | `#F3F4F6`  | `#1F2937`  | `#D1D5DB`    |
| Blue      | `#10233D` | `#52A8FF` | `#EFF6FF`  | `#1D4ED8`  | `#93C5FD`    |
| Purple    | `#2E1938` | `#BF7AF0` | `#FAF5FF`  | `#7E22CE`  | `#D8B4FE`    |
| Orange    | `#331B00` | `#FF990A` | `#FFF7ED`  | `#C2410C`  | `#FDBA74`    |
| Red       | `#3C1618` | `#FF6166` | `#FEF2F2`  | `#B91C1C`  | `#FCA5A5`    |
| Pink      | `#3A1726` | `#F75F8F` | `#FDF2F8`  | `#BE185D`  | `#F9A8D4`    |
| Green     | `#0F2E18` | `#62C073` | `#F0FDF4`  | `#15803D`  | `#86EFAC`    |
| Teal      | `#062822` | `#0AC7B4` | `#F0FDFA`  | `#0F766E`  | `#5EEAD4`    |

### Edge Style

Smooth-step path with an arrow marker. Default edge color: `#f8fafc`. Stroke width is thin — edges are visually secondary to nodes.

### Node Shapes

6 supported shapes, defined in `types/canvas.ts` as `NODE_SHAPES`. Complex shapes (diamond, hexagon, cylinder) are rendered as inline SVGs rather than CSS borders.

- `rectangle` — default general-purpose node
- `diamond` — decision / gateway
- `circle` — event / endpoint
- `pill` — service / process
- `cylinder` — database / storage
- `hexagon` — external system / boundary

### Connection Handles

Small white circular handles, hidden by default, revealed on node hover. Appear at all four sides of a node.

### Canvas Background

React Flow `<Background>` component. Canvas sits on the base background color.

## Component Library

shadcn/ui on top of Tailwind. No custom design system. Components live in `components/ui/`. Use the `shadcn` CLI to add new components rather than writing them from scratch.

## Layout Patterns

- Editor workspace: full-viewport layout — floating sidebar overlay on the left, center canvas, slide-over AI sidebar on the right.
- Canvas presence: collaborator avatars and the current user's UserMenu sit in a floating pill at the top-right of the editor canvas, not in the navbar. Live cursors for other participants render in flow coordinates. When another collaborator selects a node, that node shows a ring in their presence color. Resize handles and the color toolbar appear only for the local user's selection.
- Sidebars: floating overlay with dark semi-transparent background and subtle border.
- Modals and dialogs: centered overlay, `rounded-3xl`, dark background with backdrop blur.
- Navbar: top bar with dark background and bottom border.

## Icons

Lucide React. Stroke-based icons only — no filled variants. Icon sizes: `h-4 w-4` for inline, `h-5 w-5` for buttons, `h-8 w-8` for feature icons in empty states.
