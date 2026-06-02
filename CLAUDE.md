# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important: Non-standard Next.js version

This project uses Next.js 16.2.7 with React 19.2.4 — versions likely beyond your training data. APIs, conventions, and file structure may differ from what you know. **Read the relevant guide in `node_modules/next/dist/docs/` before writing any code.** Heed deprecation notices.

## Commands

```bash
npm run dev      # Start development server at http://localhost:3000
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

There is no test suite configured.

## Architecture

This is a Next.js App Router project using JavaScript (not TypeScript). The `app/` directory is the entire application:

- `app/layout.js` — root layout; sets up Geist font variables and the `<html>`/`<body>` shell
- `app/page.js` — home route (`/`)
- `app/globals.css` — Tailwind v4 import and CSS custom properties for `--background`/`--foreground` theming

**Styling:** Tailwind CSS v4 (configured via `postcss.config.mjs` with `@tailwindcss/postcss`). Tailwind v4 differs significantly from v3 — theme tokens are defined with `@theme inline` in CSS, not `tailwind.config.js`.

**Backend/data:** Firebase 12 is installed as a dependency but not yet wired up. Check `node_modules/next/dist/docs/` for the current patterns for Firebase integration with this Next.js version before adding data access code.

**Fonts:** Geist Sans and Geist Mono loaded via `next/font/google` and exposed as CSS variables (`--font-geist-sans`, `--font-geist-mono`).
