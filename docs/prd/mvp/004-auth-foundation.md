---
id: "004"
title: Auth foundation (Google OAuth + dev-login)
status: Implemented
phase: MVP
owner: PM
created: 2026-06-01
last_updated: 2026-06-01
rfc: ../../rfc/0004-auth-foundation.md
---

# 004 — Auth foundation

## 1. Problem / Frustration

The product is multi-user from the start (friends later). If we don't tie data
to a user from day one, we pay a painful migration later. We also need a
low-friction way to log in during development without setting up OAuth.

## 2. Goals

- A user can sign in with their Google account.
- Every domain record is owned by an authenticated `userId`.
- Developers can sign in locally with just an email (no OAuth setup).

## 3. Non-goals

- Email/password registration, password reset.
- Roles/permissions, teams, org accounts.
- Profile management UI beyond what auth provides.

## 4. User stories

- As a user, I sign in with Google so I can access my data securely.
- As a developer, I sign in on dev/staging with only an email so I can test fast.

## 5. Scope (this phase)

- Google OAuth provider (production path).
- Email-only **dev-login** gated behind `DEV_LOGIN_ENABLED`, off in production.
- Authenticated app shell: unauthenticated users are redirected to `/login`.
- Session carries the app `userId`.

## 6. Success metric

Both sign-in paths work; protected routes require a session; dev-login is
impossible to enable in a production build.

## 7. Open questions

- Login screen visual design (defer to RFC/UI).
