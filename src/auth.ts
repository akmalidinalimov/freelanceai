import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { upsertTelegramUser, upsertEmailUser } from "@/lib/users";
import { consumeMagicToken } from "@/lib/email-auth";
import { verifyMiniAppInitData } from "@/lib/telegram";
import { consumeLoginNonce } from "@/lib/login-nonce";
import { stampLastLogin } from "@/server/services/activity";
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
    Credentials({
      // Passwordless email login. The magic-link email carries a single-use token
      // (created + stored by /api/auth/email/request); the callback page hands it
      // here. Consuming the token verifies the address, so we upsert + sign in.
      id: "email-link",
      name: "Email",
      credentials: { token: { type: "text" } },
      async authorize(credentials) {
        const token = typeof credentials?.token === "string" ? credentials.token : "";
        if (!token) return null;
        const email = await consumeMagicToken(token);
        if (!email) return null;
        const user = await upsertEmailUser(email);
        if (user.status !== "ACTIVE") return null;
        return {
          id: user.id,
          name: user.firstName ?? user.name ?? email.split("@")[0],
          image: user.photoUrl ?? user.image ?? undefined,
        };
      },
    }),
    Credentials({
      // Passwordless login INSIDE a Telegram Mini App. The WebView posts the signed
      // `initData`; verifyMiniAppInitData validates it against the bot token (HMAC) and
      // its freshness — that signature IS the proof of identity, so no password/nonce.
      // This is what makes "open the app in Telegram once → logged in forever" work.
      id: "telegram-miniapp",
      name: "Telegram Mini App",
      credentials: { initData: { type: "text" } },
      async authorize(credentials) {
        const initData = typeof credentials?.initData === "string" ? credentials.initData : "";
        if (!initData) return null;
        // Short freshness window: initData carries no browser-nonce (unlike the
        // deep-link flow), so cap the replay window to the login moment (10 min).
        const tg = verifyMiniAppInitData(initData, { maxAgeSeconds: 600 });
        if (!tg) return null;
        // Single-use: record the verified initData hash so a captured payload can't be
        // replayed within the 10-min window. First login wins; a replay is rejected.
        const hash = new URLSearchParams(initData).get("hash");
        if (!hash || !(await consumeLoginNonce(hash, 600))) return null;
        const user = await upsertTelegramUser({ ...tg, authDate: Math.floor(Date.now() / 1000) });
        if (user.status !== "ACTIVE") return null;
        return {
          id: user.id,
          name: user.firstName ?? user.username ?? "User",
          image: user.photoUrl ?? undefined,
        };
      },
    }),
    // Test-only login for automated E2E. Present ONLY when E2E_TEST_AUTH=1 AND the app is
    // serving a LOCALHOST origin. The origin check is the hard backstop: even if
    // E2E_TEST_AUTH leaked into a prod deploy, this passwordless impersonation provider
    // still can't register because prod pins AUTH_URL=https://gigora.ai. (A NODE_ENV guard
    // can't be used here: Playwright runs against `next start`, which forces
    // NODE_ENV=production, so it would disable the provider in CI too.) Lets Playwright
    // sign in as a seeded user by id.
    ...(process.env.E2E_TEST_AUTH === "1" &&
    /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/.test(
      process.env.AUTH_URL ?? process.env.APP_ORIGIN ?? ""
    )
      ? [
          Credentials({
            id: "e2e",
            name: "e2e",
            credentials: { userId: { type: "text" } },
            async authorize(credentials) {
              const userId = typeof credentials?.userId === "string" ? credentials.userId : "";
              if (!userId) return null;
              const user = await prisma.user.findUnique({ where: { id: userId } });
              return user ? { id: user.id, name: user.firstName ?? user.username ?? "E2E" } : null;
            },
          }),
        ]
      : []),
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
      if (user?.id) {
        token.uid = user.id;
        // `user` is only present on the sign-in request → this is the login moment.
        stampLastLogin(user.id);
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) session.user.id = token.uid as string;
      return session;
    },
  },
});
