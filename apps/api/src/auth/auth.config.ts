import { loadEnvFromProcess } from "@shotbro/config/env";
import { passwordResetTemplate, sendEmail, verifyEmailTemplate } from "@shotbro/email";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Db } from "@shotbro/db/client";
import * as schema from "@shotbro/db/schema";

function emailVerificationOptions() {
  const mailEnv = loadEnvFromProcess();
  if (!mailEnv.EMAIL_ENABLED) return undefined;
  return {
    sendOnSignUp: true,
    sendOnSignIn: true,
    expiresIn: mailEnv.EMAIL_TOKEN_TTL_MINUTES * 60,
    sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
      const template = verifyEmailTemplate({
        verifyUrl: url,
        expiresMinutes: mailEnv.EMAIL_TOKEN_TTL_MINUTES,
      });
      void sendEmail(mailEnv, user.email, template, `verify:${user.email}`).catch(() => undefined);
    },
  };
}

/** Return type widened: admin plugin pulls zod v4 types that break `declaration` emit (TS2742). */
export function createAuth(db: Db, env: { secret: string; baseURL: string; trustedOrigins: string[] }): Auth {
  const emailEnabled = process.env.EMAIL_ENABLED === "true";
  const requireEmailVerification =
    emailEnabled && process.env.EMAIL_VERIFICATION_REQUIRED !== "false";
  return betterAuth({
    secret: env.secret,
    baseURL: env.baseURL,
    trustedOrigins: env.trustedOrigins,
    emailVerification: emailVerificationOptions(),
    emailAndPassword: {
      enabled: true,
      disableSignUp: process.env.ALLOW_PUBLIC_REGISTER !== "true",
      requireEmailVerification,
      sendResetPassword: emailEnabled
        ? async ({ user, url }: { user: { email: string }; url: string }) => {
            const mailEnv = loadEnvFromProcess();
            const template = passwordResetTemplate({
              resetUrl: url,
              expiresMinutes: mailEnv.EMAIL_TOKEN_TTL_MINUTES,
            });
            void sendEmail(mailEnv, user.email, template, `reset:${user.email}`).catch(() => undefined);
          }
        : undefined,
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
    plugins: [admin()],
  }) as Auth;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Auth = any;
