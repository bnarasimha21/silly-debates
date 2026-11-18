import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { prisma } from "./prisma";
import { track } from "./track";
import { getVisitorId } from "./visitor";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
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
