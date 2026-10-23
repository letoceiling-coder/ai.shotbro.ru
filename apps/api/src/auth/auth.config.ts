import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Db } from "@shotbro/db/client";
import * as schema from "@shotbro/db/schema";

export function createAuth(db: Db, env: { secret: string; baseURL: string; trustedOrigins: string[] }) {
  return betterAuth({
    secret: env.secret,
    baseURL: env.baseURL,
    trustedOrigins: env.trustedOrigins,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: env.trustedOrigins.length > 0 && process.env.EMAIL_ENABLED === "true",
    },
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
  });
}

export type Auth = ReturnType<typeof createAuth>;
