// next-auth.d.ts

import NextAuth, { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    /** You add `user_group` here */
    user: {
      /** keep the default fields */
      name?: string | null;
      email?: string | null;
      image?: string | null;
      /** your custom field: */
      user_group: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    /** Ensure any user object coming from your database has this too */
    user_group: string;
  }
}
