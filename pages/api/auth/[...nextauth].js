import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
// If you later enable Azure AD, uncomment the provider & config:
// import AzureADProvider from "next-auth/providers/azure-ad";
import bcrypt from "bcryptjs";
import queryDatabase from "../../../lib/database";

/** Normalize a user row coming from DB */
/**
 * @param {object} row
 * @returns {object}
 */
function normalizeUserRow(row = {}) {
  // Work on a shallow copy so we don't accidentally mutate shared objects
  const normalized = { ...row };

  // normalize role casing / whitespace
  const rawGroup = normalized.user_group ?? "";
  normalized.user_group = String(rawGroup).trim();

  // ensure we always expose a plant the API can read
  if (!normalized.fixture_plant) {
    // prefer a name if present; fall back to id string; otherwise null
    normalized.fixture_plant =
      normalized.plant_name ??
      (normalized.plant_id != null ? String(normalized.plant_id) : null);
  }

  // 🔹 Normalize must_change_password -> both numeric and boolean helper
  const rawFlag = normalized.must_change_password ?? 0;
  const flagNum = Number(rawFlag) === 1 ? 1 : 0;
  normalized.must_change_password = flagNum; // stays compatible with DB
  normalized.mustChangePassword = !!flagNum; // convenient for frontend

  return normalized;
}

/**
 * @type {import("next-auth").NextAuthOptions}
 */
export const authOptions = {
  // Explicitly use JWT sessions (no DB adapter for sessions)
  session: {
    strategy: "jwt",
    // maxAge: 30 * 24 * 60 * 60, // 30 days (optional)
  },

  // 🔹 Make the session cookie explicit & robust (important for mobile Edge)
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax", // "lax" is OK as long as you stay on one domain
        path: "/",
        secure: true, // you're on HTTPS behind nginx
      },
    },
  },

  providers: [
    // If you later want Azure AD, uncomment and set env vars
    /*
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID ?? "",
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET ?? "",
      tenantId: process.env.AZURE_AD_TENANT_ID ?? "",
    }),
    */
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email or User ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // 🔎 DEBUG LOG
        console.log("🔐 [authorize] called with:", {
          hasEmail: !!credentials?.email,
          hasPassword: !!credentials?.password,
        });

        try {
          if (!credentials?.email || !credentials?.password) {
            throw new Error("Missing credentials");
          }

          // User can type either email OR user_id in the same field
          const identifier = credentials.email;
          const password = credentials.password;

          // 🔹 Fetch user ONLY by identifier (no password in WHERE)
          const rows = await queryDatabase(
            `SELECT u.*, p.plant_name
             FROM Users u
             LEFT JOIN Plants p ON p.entry_id = u.plant_id
             WHERE (u.email = ? OR u.user_id = ?)
             LIMIT 1`,
            [identifier, identifier]
          );

          if (!rows || rows.length === 0) {
            console.log("🔐 [authorize] no user found for", identifier);
            throw new Error("Invalid account");
          }

          const userRow = rows[0];

          // 🔹 Compare plain password with hashed password from DB
          const isValid = await bcrypt.compare(
            password,
            userRow.user_password
          );

          if (!isValid) {
            console.log("🔐 [authorize] invalid password for", identifier);
            throw new Error("Invalid account");
          }

          const normalized = normalizeUserRow(userRow);
          console.log("🔐 [authorize] success for user_id:", normalized.user_id);

          // Return the full normalized row; we'll store it into token.user
          return normalized;
        } catch (err) {
          console.error("❌ Auth error:", err);
          throw new Error("Invalid account");
        }
      },
    }),
  ],

  pages: {
    signIn: "/signin",
    error: "/signin",
  },

  // Keep your secret
  secret: "Sy21b2!G*&JY!GYGaknlngkdsbsi!NUI#GVUYT!^&Vy",

  callbacks: {
    /** Put normalized user info into the JWT on login */
    async jwt({ token, user }) {
      if (user) {
        console.log(
          "🧩 [jwt] new login, setting token.user for",
          user.user_id,
          user.email
        );
        // user is the full DB row (already normalized in authorize)
        token.user = normalizeUserRow(user);
      } else {
        console.log("🧩 [jwt] existing token, has user?", !!token.user);
      }
      return token;
    },

    /**
     * Expose normalized user info on the session for client & API usage.
     * Prefer the JWT payload (fast, already normalized).
     * If token has no user (rare), refetch from DB as a fallback.
     */
    async session({ session, token }) {
      console.log("📦 [session] token has user?", !!token?.user);

      if (token?.user) {
        session.user = token.user;
        return session;
      }

      const currentUser = session?.user || {};
      const identifier =
        currentUser.email ||
        currentUser.user_id ||
        currentUser.name ||
        null;

      if (!identifier) {
        console.log(
          "📦 [session] no identifier to refetch user, returning minimal session"
        );
        return session;
      }

      const rows = await queryDatabase(
        `SELECT * FROM Users WHERE email = ? OR user_id = ? LIMIT 1`,
        [identifier, identifier]
      );

      if (rows.length === 0) {
        console.error("[session] user not found during refetch");
        throw new Error("Something went wrong");
      }

      session.user = normalizeUserRow(rows[0]);
      return session;
    },

    /** Safer redirect handling */
    async redirect({ url, baseUrl }) {
      try {
        // If relative, it's safe
        if (url.startsWith("/")) {
          return url;
        }

        const target = new URL(url);
        const base = new URL(baseUrl);

        if (target.origin === base.origin) {
          return url;
        }

        // Block external origins: always go home
        return baseUrl;
      } catch (e) {
        console.error("🔁 [redirect] error parsing URL:", e, "url:", url);
        return baseUrl;
      }
    },

    /** Optional signIn gate (you can add IP/device checks here) */
    async signIn() {
      return true;
    },
  },
};

export default NextAuth(authOptions);
