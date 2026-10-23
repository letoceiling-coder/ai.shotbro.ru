import { Controller, Get, Param, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import type { AuthedRequest } from "../auth/session.guard";
import { SessionGuard } from "../auth/session.guard";
import { AccessPolicyService } from "../access/access-policy.service";
import { EventLogService } from "./event-log.service";
import { Inject } from "@nestjs/common";
import type { Db } from "@shotbro/db/client";
import { DB } from "../database/database.module";

@Controller("api/v1/projects/:projectId/events")
@UseGuards(SessionGuard)
export class EventsController {
  constructor(
    private readonly events: EventLogService,
    private readonly access: AccessPolicyService,
    @Inject(DB) private readonly db: Db,
  ) {}

  @Get()
  list(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Query("after") after?: string) {
    return this.events.listSince(projectId, after);
  }

  @Get("stream")
  async stream(
    @Req() req: Request & AuthedRequest,
    @Param("projectId") projectId: string,
    @Query("after") after: string | undefined,
    @Res() res: Response,
  ) {
    await this.access.assertProjectAccess(this.db, req.user.id, projectId);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 15000);

    const batch = await this.events.listSince(projectId, after);
    for (const ev of batch) {
      res.write(`id: ${ev.eventId}\n`);
      res.write(`event: ${ev.type}\n`);
      res.write(`data: ${JSON.stringify(ev)}\n\n`);
    }

    req.on("close", () => {
      clearInterval(heartbeat);
      res.end();
    });
  }
}
