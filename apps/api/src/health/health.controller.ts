import { Controller, Get, Inject } from "@nestjs/common";
import type { Db } from "@shotbro/db/client";
import { sql } from "drizzle-orm";
import { DB } from "../database/database.module";

@Controller("api/v1/health")
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get("live")
  live() {
    return { status: "ok" };
  }

  @Get("ready")
  async ready() {
    await this.db.execute(sql`select 1`);
    return { status: "ready" };
  }
}
