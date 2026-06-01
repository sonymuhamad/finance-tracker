---
id: "0004"
title: Auth foundation (Google OAuth + dev-login)
status: Implemented
prd: ../prd/mvp/004-auth-foundation.md
author: Engineering
created: 2026-06-01
last_updated: 2026-06-01
last_verified: 2026-06-01
---

# RFC 0004 — Auth foundation

> Implements PRD [004](../prd/mvp/004-auth-foundation.md).

## 1. Context

The product is multi-user from day one. We need Google OAuth for real sign-in
and a frictionless email-only dev-login for local/staging. Every domain record
is owned by an authenticated `userId`.

## 2. Design

### Auth config (`src/lib/auth.ts`, already scaffolded)
- Auth.js v5, Prisma adapter, **JWT** session strategy (required for Credentials).
- Providers: `Google`; plus a `dev-login` Credentials provider, included only
  when `DEV_LOGIN_ENABLED === "true"`. `authorize()` upserts the user by email.
- Callbacks put the app `userId` on the JWT and session.

### Feature module (`src/features/auth/`)
- `service.ts`
  - `getCurrentUser()` → `session.user | null`.
  - `requireUser()` → returns the user, or `redirect("/login")`.
- `actions.ts` (`"use server"`)
  - `signInWithGoogle()` → `signIn("google", { redirectTo: "/" })`.
  - `signInWithDevLogin(formData)` → validates email (Zod), `signIn("dev-login", …)`.
  - `signOutAction()` → `signOut({ redirectTo: "/login" })`.
- `components/login-form.tsx` (`"use client"`) — Google button + (conditionally)
  dev-login email form, with pending state.

### Routing
- Route groups: `(auth)/login` (public) and `(app)/*` (protected).
- `(app)/layout.tsx` is a server component that calls `requireUser()` and renders
  the app shell (`components/app-shell.tsx` nav + sign-out).
- `(auth)/login/page.tsx` redirects to `/` if already authenticated.
- Route protection is done in the server layout (Node runtime) — **no edge
  middleware**, because the Prisma/pg adapter isn't edge-compatible.

## 3. Alternatives considered

- **Edge middleware** for protection — rejected: Prisma adapter can't run on edge
  without a split config; server-layout guard is simpler and sufficient.
- **Database sessions** — rejected: Credentials dev-login requires JWT strategy.

## 4. Risks & trade-offs

- Dev-login must never be enabled in production → gated by env, documented, and
  off by default in `.env.example` guidance.
- JWT sessions: sign-out is immediate per request; no server-side revocation
  list (acceptable for this product).

## 5. Test plan

- Unit: `signInWithDevLogin` rejects invalid/empty email (Zod).
- Manual: Google sign-in (when creds set); dev-login creates+signs in a user;
  visiting `/` unauthenticated redirects to `/login`.

## 6. Rollout

No migration (auth tables already exist). Requires `AUTH_SECRET`; Google needs
`AUTH_GOOGLE_ID/SECRET`. Production build must set `DEV_LOGIN_ENABLED=false`.

## 7. Implementation checklist

- [x] `features/auth/service.ts` (requireUser/getCurrentUser)
- [x] `features/auth/actions.ts` (google/dev/sign-out)
- [x] `features/auth/schema.ts` (dev-login email)
- [x] `(auth)/login` page + `login-form`
- [x] `(app)/layout` guard + `app-shell`
- [x] Tests; `/simplify` + `/code-review`
- [x] RFC synced, `last_verified` set
