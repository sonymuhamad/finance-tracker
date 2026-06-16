import type { NextConfig } from "next";

// Baseline security response headers (review: backend H1). Applied to every
// route. A full nonce-based Content-Security-Policy is deferred (it needs
// per-request nonces to not break Next's inline scripts) — tracked in
// docs/pre-launch-hardening.md; here we ship the clickjacking + sniffing +
// transport + referrer protections, which are safe to apply globally.
const securityHeaders = [
  // Block framing (clickjacking → a logged-in user tricked into firing a
  // money-recording / wallet-deleting server action). Both the legacy header
  // and the modern CSP directive, for coverage.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // HSTS — ignored by browsers over plain http (dev), enforced once on https.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
