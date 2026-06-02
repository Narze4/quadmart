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
node scripts/seed.mjs  # Seed Firestore with 20 sample listings
```

There is no test suite configured.

## Architecture

Next.js App Router project in JavaScript (not TypeScript). All pages are Client Components (`'use client'`) because they depend on Firebase Auth state.

### Routing

After login/signup users land on `/dashboard`. Unauthenticated access to any protected page redirects to `/login`.

| Route | Page |
|---|---|
| `/` | Public landing page (server component) |
| `/login` | Login form |
| `/signup` | Signup form — enforces `.edu` email |
| `/dashboard` | Protected — hero banner + university-filtered featured listings |
| `/marketplace` | Protected — full listing grid with filters, search, sort |
| `/sell` | Protected — 6-step multi-step form |
| `/my-listings` | Protected — seller's own listings with Active/Reserved/Sold tabs |
| `/cart` | Protected — cart empty state |
| `/my-purchases` | Protected — Pending/Completed/Expired tabs |
| `/messages` | Protected — conversation inbox |
| `/messages/[id]` | Protected — real-time chat thread |
| `/settings` | Protected — display name, password change, delete account |

### Shared components

**`components/Navbar.js`** — white navbar used on all authenticated pages. Uses `usePathname()` to highlight the active page with a gray pill. Nav order: Sell · My Listings · cart icon · bell icon · My Purchases · Messages · Settings. Logo links to `/dashboard`.

### Auth

**`lib/auth-context.js`** exports `AuthProvider` and `useAuth`. All protected pages use a `useEffect` guard on `{ user, loading }` and redirect to `/login` when unauthenticated. Show a spinner while `loading` is true.

### Firebase

**`lib/firebase.js`** exports `db` (Firestore) and `auth` (Auth), initialized with a `getApps()` guard. Credentials come from `NEXT_PUBLIC_FIREBASE_*` env vars (`.env.local` locally, Vercel environment variables in production).

**`lib/utils.js`** exports:
- `getUniversity(email)` — maps email domain to university name
- `getUsername(user)` — returns `displayName` or email local-part
- `getDomain(email)` — returns the domain portion of an email

### Firestore schema

- `listings` — `{ title, description, price, category, condition, sellerEmail, createdAt }`
- `conversations` — `{ participants: [email, email], listingId, listingTitle, lastMessage, lastMessageAt, createdAt }`
- `conversations/{id}/messages` — `{ text, senderEmail, createdAt }`

### Styling

Tailwind CSS v4 (`@tailwindcss/postcss`). Tailwind v4 differs from v3 — theme tokens use `@theme inline` in CSS, not `tailwind.config.js`.

- Primary green: `#22c55e` (`green-500`) for buttons and accents
- Hover green: `#15803d` (`green-700`)
- Dashboard hero gradient: `#2d8a5e → #1a5c3a` (inline style)

### Deployment

Vercel (auto-deploys on push to `main`). Firebase authorized domains must include the Vercel deployment URL for Auth to work. The Firebase project and Firestore database are shared between local and production — seed data appears on both immediately.
