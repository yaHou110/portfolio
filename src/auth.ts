/**
 * Auth.js v5 configuration.
 *
 * v1 uses Credentials provider + JWT sessions. The DrizzleAdapter is NOT
 * needed here — it's only required for OAuth/database sessions. We may add
 * it later when OAuth providers are introduced.
 *
 * See ADR-0005 (revised 2026-07-13, Session 015) for the full auth design
 * and the rationale for the per-request `isActive` re-check that closes the
 * JWT deactivation gap.
 */
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyPassword, CredentialsInputSchema } from "@learning-platform/core/auth";
import { getDb } from "@learning-platform/core/db";
import { identity } from "@learning-platform/core/api";
import type { Role } from "@learning-platform/core/db/schema";
import { env } from "@/lib/env";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      tenantId: string;
    };
  }
}

const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  secret: env.AUTH_SECRET,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        tenantSlug: { label: "Tenant", type: "text" },
        nationalId: { label: "National ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = CredentialsInputSchema.safeParse(raw);
        if (!parsed.success) return null;
        const result = await verifyPassword(getDb(), parsed.data);
        if (!result.ok) return null;
        return {
          id: result.user.id,
          email: result.user.email,
          name: result.user.displayName,
          role: result.user.role,
          tenantId: result.user.tenantId,
        };
      },
    }),
  ],
  callbacks: {
      async redirect({ url, baseUrl }) {
        // Allow same-origin relative URLs
        if (url.startsWith("/")) return `${baseUrl}${url}`;
        // Allow same-origin absolute URLs
        if (url.startsWith(baseUrl)) return url;
        // Default to dashboard
        return `${baseUrl}/dashboard`;
      },
      async jwt({ token, user }) {
      if (user) {
        const u = user as { id: string; role: Role; tenantId: string };
        token.id = u.id;
        token.role = u.role;
        token.tenantId = u.tenantId;
      }
      return token;
    },
    async session({ session, token }) {
      if (!token?.id) return session;
      // Per-request deactivation re-check. ADR-0005 §Revision 1:
      // Auth.js Credentials only supports JWT, so we close the deactivation
      // gap by verifying the user still exists and is active on every
      // `auth()` call. Cost: one primary-key lookup per request, sub-ms.
      const status = await identity.checkUserActive(token.id as string);
      if (!status.exists || !status.active) {
        // Returning a session with no user makes `auth()` return null in
        // route handlers, so they correctly emit 401.
        return { ...session, user: undefined as unknown as typeof session.user };
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.tenantId = token.tenantId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};

const _nextAuth = NextAuth(authConfig);

export const handlers = _nextAuth.handlers;
export const auth = _nextAuth.auth;
export const signIn: typeof _nextAuth.signIn = _nextAuth.signIn;
export const signOut: typeof _nextAuth.signOut = _nextAuth.signOut;
