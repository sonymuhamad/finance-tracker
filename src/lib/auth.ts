import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

/**
 * Auth.js (NextAuth v5) configuration.
 *
 * - Production: Google OAuth only.
 * - Dev/staging: an extra email-only "dev-login" that upserts a user and signs
 *   in without OAuth. It's a full authentication bypass (any email, no
 *   password), so it MUST be impossible in production.
 *
 * Two-layer guard: it requires `DEV_LOGIN_ENABLED === "true"` AND a non-production
 * `NODE_ENV`. The `NODE_ENV` clause makes the provider structurally absent from
 * any production build even if the env var is accidentally left on (defence in
 * depth — the gate is opt-out by omission *and* hard-disabled in prod). The
 * deploy checklist (docs/pre-launch-hardening.md) still verifies the host env.
 *
 * Session strategy is JWT (required for the Credentials dev-login). The Prisma
 * adapter still persists users and linked OAuth accounts.
 */

const devLoginEnabled =
  process.env.DEV_LOGIN_ENABLED === "true" &&
  process.env.NODE_ENV !== "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    ...(devLoginEnabled
      ? [
          Credentials({
            id: "dev-login",
            name: "Dev Login",
            credentials: {
              email: { label: "Email", type: "email" },
            },
            async authorize(credentials) {
              const email =
                typeof credentials?.email === "string"
                  ? credentials.email.trim().toLowerCase()
                  : "";
              if (!email) return null;

              const user = await prisma.user.upsert({
                where: { email },
                update: {},
                create: { email, name: email.split("@")[0] },
              });

              return {
                id: user.id,
                email: user.email,
                name: user.name,
                image: user.image,
              };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
