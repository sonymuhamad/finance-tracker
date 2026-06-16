# Pre-launch hardening checklist

> Source: the multi-agent review (security + backend architecture) on
> 2026-06-16. The **code-level** fixes are done on branch `fix/review-hardening`
> (cross-entity IDOR guard, dev-login hard-gate, amount caps, security headers,
> pinned auth deps). The items below are **deploy/ops tasks** that can't be
> closed in code alone — they must be verified in the production environment
> before opening sign-ups. This is the gate for Release v0.0.1.

## Blockers — must be true before others can sign up

- [ ] **Dev-login is off in production.** Code already hard-disables it when
  `NODE_ENV === "production"` (`src/lib/auth.ts`), but also confirm
  `DEV_LOGIN_ENABLED` is unset / `false` in the host's env. (No `/api/auth/
  callback/dev-login` route should exist in the prod deploy.)
- [ ] **`AUTH_SECRET` is unique and high-entropy** (`openssl rand -base64 32` or
  `bunx auth secret`), set only in the host's secret store — never reused from
  dev/staging. The app refuses to boot without it (Auth.js `MissingSecret`).
- [ ] **`DATABASE_URL` uses `sslmode=require`** (ideally `verify-full` with the
  provider CA) for the managed Postgres — never `sslmode=disable`.
- [ ] **`AUTH_URL` = the exact production https origin** and `AUTH_TRUST_HOST=true`
  if behind the platform's proxy (verify cookies are issued `Secure`).
- [ ] **Google OAuth**: production client id/secret + the prod callback URL
  registered in Google Cloud Console.

## Strongly recommended within the launch window

- [ ] **Rate limiting** on `/api/auth/*` (per-IP) and mutating server actions
  (per-user) — via the hosting platform's WAF/rate-limit, or an Upstash-style
  limiter in middleware. Needs a shared store (serverless has no in-process
  state), so it's platform/infra, not a code-only change.
- [ ] **Error monitoring** (Sentry or the host's equivalent) wired to capture the
  errors `runAction` re-throws + auth events. **Scrub PII**: configure the SDK to
  drop `email`, `amount`, `targetBalance`, `startingBalance`, and `note` from
  captured payloads (org policy: no PII/secrets to third parties).
- [ ] **Connection-pool ceiling** appropriate to the managed instance (single
  shared PrismaClient).

## Follow-ups (post-launch)

- [ ] **Full Content-Security-Policy** with per-request nonces. The baseline
  headers (`X-Frame-Options`, `frame-ancestors 'none'`, `nosniff`,
  `Referrer-Policy`, HSTS) ship now in `next.config.ts`; a strict `default-src`
  CSP needs nonce plumbing so it doesn't break Next's inline scripts.
- [ ] **Dependency audit** (`bun audit`) as a pre-release gate; plan the move off
  `next-auth` beta to a stable v5 once released (now pinned exact).
- [ ] Revisit `allowDangerousEmailAccountLinking` if/when a second auth provider
  is added (safe for Google-only, where email is provider-verified).
