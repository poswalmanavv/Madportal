import bcrypt from "bcryptjs";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { connectDB } from "./db";
import { isNitkkrEmail, isSecretaryEmail } from "./rbac";
import User from "@/models/User";

export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30 days
  jwt: { maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login/member"
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: {},
        password: {},
        year: {},
        portal: {},
        rememberMe: {}
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        const portal = String(credentials?.portal ?? "member");
        const year = String(credentials?.year ?? "");

        if (!isNitkkrEmail(email)) return null;
        if (portal === "admin" && !isSecretaryEmail(email)) return null;

        await connectDB();
        const user = await User.findOne({ email }).select("+passwordHash");
        if (!user) return null;
        if (portal === "member" && user.year !== year) return null;
        if (portal === "admin" && user.role !== "secretary") return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user._id.toString(),
          name: String(user.name),
          email: String(user.email),
          year: String(user.year),
          role: String(user.role),
          teamHeadRole: user.teamHeadRole ? String(user.teamHeadRole) : null,
          // Mongoose stores this as a DocumentArray, which structuredClone (used
          // by jose during JWT encoding) cannot clone. Convert to a plain string[].
          departments: Array.from(user.departments ?? [], (d) => String(d)),
          canManageTeam: Boolean(user.canManageTeam),
          rememberMe: credentials?.rememberMe === "true"
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) Object.assign(token, user);
      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: String(token.id),
        name: String(token.name),
        email: String(token.email),
        year: token.year as never,
        role: token.role as never,
        teamHeadRole: token.teamHeadRole as never,
        departments: token.departments as never,
        canManageTeam: Boolean(token.canManageTeam)
      };
      return session;
    }
  }
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
