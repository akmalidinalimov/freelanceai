import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { upsertTelegramUser } from "@/lib/users";
import { readCookie, sha256 } from "@/lib/rate-limit";

/**
 * Auth.js (NextAuth v5). JWT sessions (required by the Credentials/Telegram bridge,
 * and avoids a per-request session-store lookup). The Prisma adapter persists Google
 * users + their Account rows; the Telegram bridge persists via upsertTelegramUser.
 * Role/status are read fresh from the DB in getCurrentUser, so the JWT only carries
 * the user id (changes like admin-promote/suspend take effect immediately).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  pages: { signIn: "/login" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Link a Google login to an existing user with the same verified email.
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      id: "telegram",
      name: "Telegram",
      credentials: { token: { type: "text" } },
      async authorize(credentials, request) {
        const token = typeof credentials?.token === "string" ? credentials.token : "";
        if (!token) return null;

        const lt = await prisma.loginToken.findUnique({ where: { token } });
        if (!lt || lt.status !== "CONFIRMED" || lt.expiresAt < new Date() || !lt.telegramId) {
          return null;
        }
        // Browser binding: the httpOnly nonce cookie set on /start must match the
        // hash stored on the token — blocks login-CSRF / leaked-deep-link takeover.
        const nonce = readCookie(request, "fa_login_nonce");
        if (!lt.browserNonceHash || !nonce || sha256(nonce) !== lt.browserNonceHash) {
          return null;
        }

        // Consume (single-use) + upsert atomically: a failed upsert rolls back consume.
        const user = await prisma.$transaction(async (tx) => {
          const consumed = await tx.loginToken.updateMany({
            where: { token, status: "CONFIRMED" },
            data: { status: "CONSUMED" },
          });
          if (consumed.count === 0) return null;
          return upsertTelegramUser(
            {
              id: lt.telegramId!,
              firstName: lt.firstName ?? undefined,
              lastName: lt.lastName ?? undefined,
              username: lt.username ?? undefined,
              authDate: Math.floor(Date.now() / 1000),
            },
            tx
          );
        });
        if (!user) return null;

        return {
          id: user.id,
          name: user.firstName ?? user.username ?? "User",
          image: user.photoUrl ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    // Only allow Google logins with a Google-verified email (required because
    // allowDangerousEmailAccountLinking bypasses Auth.js's own verification check).
    signIn({ account, profile }) {
      if (account?.provider === "google") {
        return profile?.email_verified === true;
      }
      return true;
    },
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) session.user.id = token.uid as string;
      return session;
    },
  },
});
