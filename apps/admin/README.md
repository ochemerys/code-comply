# @codecomply/admin

CodeComply Admin — the admin portal (Vue 3 + Vite) for CodeComply, the open source inspection management system.

## Color & semantic tokens

Components must use the `@codecomply/ui` semantic color tokens rather than raw
Tailwind palette utilities (`responsive-design-guide.md` §5). The tokens are
defined as CSS custom properties in `packages/ui/src/semantic-tokens.css` and
exposed as Tailwind utilities via `packages/ui/tailwind.preset.js`. They already
carry dark-mode values, so a single semantic class works in both light and dark
themes (`class="dark"` on the root).

`pnpm --filter @codecomply/admin lint:semantic-colors` (run as part of
`pnpm --filter @codecomply/admin lint`) fails the build if any `bg|text|border|ring|…`
utility references the raw `gray`, `slate`, or `blue` palettes in `src/`.

### Token mapping

| Raw utility (do not use)                           | Semantic replacement        |
| -------------------------------------------------- | --------------------------- |
| `text-gray-900`, `text-gray-800`, `text-slate-900` | `text-text-primary`         |
| `text-gray-700/600`, `text-slate-700/600`          | `text-text-secondary`       |
| `text-gray-500/400`, `text-slate-500`              | `text-text-dim`             |
| `bg-white`                                         | `bg-bg-surface`             |
| `bg-gray-50/100`, `bg-slate-50/100`                | `bg-bg-app`                 |
| `bg-gray-900` (incl. `/alpha` overlays)            | `bg-text-primary`           |
| `border-gray-50/100/200`, `border-slate-200`       | `border-border-subtle`      |
| `border-gray-300/400`                              | `border-border-strong`      |
| `ring-gray-200`, `divide-gray-100/200`             | `ring/divide-border-subtle` |
| `*-blue-<shade>`                                   | `*-primary-<shade>`         |

The `primary` scale mirrors the standard blue palette 1:1 (e.g.
`primary-600` = `#2563eb` = `blue-600`), so blue → primary is a zero-regression
swap that also gains dark-mode awareness.

Status colors with intentional semantics (e.g. `red`/`rose` for danger,
`green`/`emerald` for success, `amber`/`yellow` for warnings) are allowed and
are not flagged by the linter.
