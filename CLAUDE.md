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

Next.js App Router project in JavaScript (not TypeScript). All pages are Client Components (`'use client'`) because they depend on Firebase Auth state. The `app/` directory:

- `app/layout.js` — root layout; wraps the entire app in `<AuthProvider>`
- `app/page.js` — public landing page (server component — no auth needed)
- `app/login/page.js` — login form; redirects to `/marketplace` on success
- `app/signup/page.js` — signup form; enforces `.edu` email; redirects to `/marketplace`
- `app/marketplace/page.js` — protected listing grid with filter tabs, search, and price range; "Message Seller" button on each card creates/finds a conversation and navigates to the thread
- `app/sell/page.js` — protected form that writes to Firestore `listings` collection
- `app/messages/page.js` — protected inbox; real-time list of conversations via `onSnapshot`
- `app/messages/[id]/page.js` — protected chat thread; real-time messages via `onSnapshot` on the `messages` subcollection; use `useParams()` from `next/navigation` to read the conversation ID

**Auth:** `lib/auth-context.js` exports `AuthProvider` and `useAuth`. All protected pages redirect to `/login` via a `useEffect` guard on `{ user, loading }` from `useAuth`. Show a spinner while `loading` is true.

**Firebase:** `lib/firebase.js` exports `db` (Firestore) and `auth` (Auth), initialized with a `getApps()` guard to prevent duplicate initialization on hot reload. Credentials come from `NEXT_PUBLIC_FIREBASE_*` env vars (`.env.local` locally, Vercel environment variables in production).

**Firestore schema:**
- `listings` — `{ title, description, price, category, condition, sellerEmail, createdAt }`
- `conversations` — `{ participants: [email, email], listingId, listingTitle, lastMessage, lastMessageAt, createdAt }`
- `conversations/{id}/messages` — `{ text, senderEmail, createdAt }`

**Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`). Brand color is `#1a472a` (dark green) used via Tailwind arbitrary values `bg-[#1a472a]`. Tailwind v4 differs from v3 — theme tokens use `@theme inline` in CSS, not `tailwind.config.js`.

**Deployment:** Vercel (auto-deploys on push to `main`). Firebase authorized domains must include the Vercel deployment URL for Auth to work.
