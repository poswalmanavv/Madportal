import bcrypt from "bcryptjs";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getUserRowWithDepartments, getUserRowWithDepartmentsByEmail } from "./queries";
import { isNitkkrEmail, isSecretaryEmail } from "./rbac";
import { clientKey, rateLimit, sweepExpired } from "./rate-limit";

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

        // Throttle credential stuffing. Keyed by IP + email so one attacker cannot lock a
        // victim out by burning their quota from somewhere else.
        sweepExpired();
        const limit = rateLimit(
          `${clientKey(request as Request, "login")}:${email}`,
          LOGIN_MAX_ATTEMPTS,
          LOGIN_WINDOW_MS
        );
        if (!limit.ok) return null;

        if (!isNitkkrEmail(email)) return null;
        if (portal === "admin" && !isSecretaryEmail(email)) return null;

        // One round trip: the user and their departments together.
        const found = await getUserRowWithDepartmentsByEmail(email);
        if (!found) return null;
        const { user, departments } = found;

        if (!user.active) return null; // deactivated members cannot sign in
        if (portal === "member" && user.year !== year) return null;
        if (portal === "admin" && user.role !== "secretary") return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          year: user.year,
          role: user.role,
          teamHeadRole: user.teamHeadRole,
          departments,
          canManageTeam: user.canManageTeam,
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

      // Re-read the user on every subsequent request. Without this, role and permission
      // fields would be frozen at sign-in for the token's 30-day life, so deactivating or
      // demoting a member would have no effect until it expired.
      if (!token.id) return token;

      // ONE round trip, not two. This callback runs on every authenticated request, so its
      // cost is paid by every page load and every API call -- it was the single most
      // expensive thing in the app when the database is far from the function.
      const found = await getUserRowWithDepartments(String(token.id));

      // Deleted or deactivated -> drop the token, which signs the user out.
      if (!found || !found.user.active) return null;
      const { user: fresh, departments } = found;

      // A password change revokes every session issued before it.
      const issuedAt = typeof token.iat === "number" ? token.iat * 1000 : 0;
      if (fresh.passwordChangedAt && issuedAt && new Date(fresh.passwordChangedAt).getTime() > issuedAt) {
        return null;
      }

      token.role = fresh.role as never;
      token.year = fresh.year as never;
      token.teamHeadRole = fresh.teamHeadRole as never;
      token.departments = departments as never;
      token.canManageTeam = fresh.canManageTeam;
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
