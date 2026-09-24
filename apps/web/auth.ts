// apps/web/auth.ts
import NextAuth from "next-auth";
import type { NextAuthResult } from "next-auth";
import GitHub from "next-auth/providers/github";
import type { Provider } from "next-auth/providers";
import { db } from "@backpressure/db";
import { users } from "@backpressure/db";

// JWT sessions (no adapter tables): the users row is created lazily on
// first sign-in so domain tables keep their foreign keys.
// Providers assemble only when their env is present, so builds and local
// runs without secrets still compile; sign-in then reports what is missing.
const providers: Provider[] = [];
if (process.env["GITHUB_ID"] && process.env["GITHUB_SECRET"]) {
  providers.push(GitHub({ clientId: process.env["GITHUB_ID"], clientSecret: process.env["GITHUB_SECRET"] }));
}

const result: NextAuthResult = NextAuth({
  session: { strategy: "jwt" },
  providers,
  callbacks: {
    async signIn({ user }) {
      if (user.email) {
        await db
          .insert(users)
          .values({ email: user.email })
          .onConflictDoNothing({ target: users.email });
      }
      return true;
    },
  },
});

export const handlers: NextAuthResult["handlers"] = result.handlers;
export const auth: NextAuthResult["auth"] = result.auth;
export const signIn: NextAuthResult["signIn"] = result.signIn;
export const signOut: NextAuthResult["signOut"] = result.signOut;
