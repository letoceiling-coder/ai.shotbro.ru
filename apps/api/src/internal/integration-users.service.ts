import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { Db } from "@shotbro/db/client";
import { user } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { loadApiEnv } from "../env";
import { AUTH } from "../auth/auth.module";
type AdminAuthApi = {
  createUser: (input: {
    body: { email: string; password: string; name: string; role?: string };
  }) => Promise<{ user: { id: string } }>;
  adminUpdateUser: (input: { body: { userId: string; data: Record<string, unknown> } }) => Promise<unknown>;
};

export type ProvisionSlot = "A" | "B";

export type ProvisionResult = {
  slot: ProvisionSlot;
  email: string;
  status: "created" | "already_exists";
  userId: string;
};

@Injectable()
export class IntegrationUsersService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AUTH) private readonly auth: { api: unknown },
  ) {}

  private adminApi(): AdminAuthApi {
    return this.auth.api as AdminAuthApi;
  }

  resolveSlot(slot: ProvisionSlot): { email: string; name: string; password: string } {
    const env = loadApiEnv();
    if (slot === "A") {
      const email = process.env.INTEGRATION_USER_A_EMAIL ?? process.env.E2E_TEST_EMAIL;
      const password = process.env.INTEGRATION_USER_A_PASSWORD ?? process.env.E2E_TEST_PASSWORD;
      if (!email || !password) {
        throw new ServiceUnavailableException("INTEGRATION_USER_A_EMAIL/PASSWORD or E2E_TEST_* not configured");
      }
      return { email: email.toLowerCase(), name: "E2E Phase2 A", password };
    }
    const email = (process.env.INTEGRATION_USER_B_EMAIL ?? "e2e-phase2-b@shotbro.test").toLowerCase();
    const password =
      process.env.INTEGRATION_USER_B_PASSWORD ??
      process.env.INTEGRATION_USER_A_PASSWORD ??
      process.env.E2E_TEST_PASSWORD;
    if (!password) {
      throw new ServiceUnavailableException("INTEGRATION_USER_B_PASSWORD or shared test password not configured");
    }
    return { email, name: "E2E Phase2 B", password };
  }

  /** Idempotent: uses Better Auth admin server API (not public sign-up). */
  async provisionSlot(slot: ProvisionSlot): Promise<ProvisionResult> {
    const { email, name, password } = this.resolveSlot(slot);
    const [existing] = await this.db.select().from(user).where(eq(user.email, email)).limit(1);
    if (existing) {
      return { slot, email, status: "already_exists", userId: existing.id };
    }

    const created = await this.adminApi().createUser({
      body: { email, name, password, role: "user" },
    });
    const userId = created.user.id;
    await this.adminApi().adminUpdateUser({
      body: { userId, data: { emailVerified: true } },
    });
    return { slot, email, status: "created", userId };
  }

  async provisionAll(): Promise<ProvisionResult[]> {
    return [await this.provisionSlot("A"), await this.provisionSlot("B")];
  }
}
