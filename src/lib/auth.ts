import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Resend from "next-auth/providers/resend";
import { prisma } from "./prisma";
import { track } from "./track";
import { getVisitorId } from "./visitor";
import { mergeVisitorVotes } from "./voter";

/** Email sign-in is offered only when a Resend key and sender are configured. */
export const emailSignInEnabled = Boolean(
  process.env.AUTH_RESEND_KEY && process.env.EMAIL_FROM
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    ...(emailSignInEnabled
      ? [Resend({ apiKey: process.env.AUTH_RESEND_KEY, from: process.env.EMAIL_FROM })]
      : []),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
      },
    }),
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      let visitorId: string | null = null;
      try {
        visitorId = await getVisitorId();
      } catch {
        // no request cookies available
      }
      // Votes cast anonymously in this browser now belong to the account.
      if (visitorId && user.id) {
        try {
          await mergeVisitorVotes(visitorId, user.id);
        } catch (error) {
          console.error("Failed to merge anonymous votes:", error);
        }
      }
      await track("signin_done", {
        visitorId,
        userId: user.id ?? null,
        props: { provider: account?.provider ?? null, newUser: !!isNewUser },
      });
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
});
