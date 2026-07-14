import bcrypt from "bcryptjs";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { connectDB } from "./db";
import { isNitkkrEmail, isSecretaryEmail } from "./rbac";
import { clientKey, rateLimit, sweepExpired } from "./rate-limit";
import User from "@backend/models/User";

const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

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
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        const portal = String(credentials?.portal ?? "member");
        const year = String(credentials?.year ?? "");

        // Throttle credential stuffing. Keyed by IP + email so one attacker cannot lock
        // out a victim by burning their quota from elsewhere.
        sweepExpired();
        const limit = rateLimit(`${clientKey(request as Request, "login")}:${email}`, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS);
        if (!limit.ok) return null;

        if (!isNitkkrEmail(email)) return null;
        if (portal === "admin" && !isSecretaryEmail(email)) return null;

        await connectDB();
        const user = await User.findOne({ email }).select("+passwordHash");
        if (!user) return null;
        if (user.active === false) return null; // deactivated members cannot sign in
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
    async jwt({ token, user }) {
      if (user) {
        Object.assign(token, user);
        return token;
      }

      // Re-read the user on every subsequent request. Without this, role/permission
      // fields are frozen at sign-in for the 30-day token lifetime, so deactivating or
      // demoting a member had no effect until it expired.
      if (!token.id) return token;
      await connectDB();
      const fresh = await User.findById(String(token.id))
        .select("role year teamHeadRole departments canManageTeam active passwordChangedAt")
        .lean<{
          role?: string;
          year?: string;
          teamHeadRole?: string | null;
          departments?: string[];
          canManageTeam?: boolean;
          active?: boolean;
          passwordChangedAt?: Date;
        }>();

      // Deleted or deactivated -> drop the token, which signs the user out.
      if (!fresh || fresh.active === false) return null;

      // A password change revokes every session issued before it.
      const issuedAt = typeof token.iat === "number" ? token.iat * 1000 : 0;
      if (fresh.passwordChangedAt && issuedAt && fresh.passwordChangedAt.getTime() > issuedAt) {
        return null;
      }

      token.role = fresh.role as never;
      token.year = fresh.year as never;
      token.teamHeadRole = (fresh.teamHeadRole ?? "None") as never;
      token.departments = Array.from(fresh.departments ?? [], (d) => String(d)) as never;
      token.canManageTeam = Boolean(fresh.canManageTeam);
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
