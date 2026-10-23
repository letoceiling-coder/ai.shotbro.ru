import { Global, Module } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import type { Db } from "@shotbro/db/client";
import { DB } from "../database/database.module";
import { loadApiEnv } from "../env";
import { createAuth, type Auth } from "./auth.config";
import { SessionGuard } from "./session.guard";

export const AUTH = Symbol("AUTH");

@Global()
@Module({
  providers: [
    {
      provide: AUTH,
      inject: [DB],
      useFactory: (db: Db): Auth => {
        const env = loadApiEnv();
        return createAuth(db, {
          secret: env.BETTER_AUTH_SECRET,
          baseURL: `${env.APP_URL}/api/auth`,
          trustedOrigins: env.TRUSTED_ORIGINS.split(",").map((s) => s.trim()),
        });
      },
    },
    {
      provide: SessionGuard,
      inject: [AUTH],
      useFactory: (auth: Auth) => new SessionGuard(auth),
    },
  ],
  exports: [AUTH, SessionGuard],
})
export class AuthModule {}

export const InjectAuth = () => Inject(AUTH);
