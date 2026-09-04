import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { findUserByEmail, membershipsForUser, seedCloudWorkspace, verifyPassword } from "./db/seed";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET || "labelator-dev-secret-change-me",
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        await seedCloudWorkspace();
        const email = String(credentials?.email ?? "").trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        const user = await findUserByEmail(email);
        if (!user?.passwordHash) return null;
        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;
        const membership = (await membershipsForUser(user.id))[0];
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: membership?.role ?? "operator",
          organizationId: membership?.organizationId,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = (user as { role?: string }).role;
        token.organizationId = (user as { organizationId?: string }).organizationId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        (session.user as { role?: string }).role = String(token.role ?? "operator");
        (session.user as { organizationId?: string }).organizationId = String(token.organizationId ?? "");
      }
      return session;
    },
  },
});
