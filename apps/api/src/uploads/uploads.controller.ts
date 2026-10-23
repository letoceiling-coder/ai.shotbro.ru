import { Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { AuthedRequest } from "../auth/session.guard";
import { SessionGuard } from "../auth/session.guard";
import { UploadsService } from "./uploads.service";

const InitSchema = z.object({
  projectId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(128),
  sizeBytes: z.number().int().positive(),
});

@ApiTags("uploads")
@Controller("api/v1/uploads")
@UseGuards(SessionGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post("init")
  init(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = InitSchema.parse(body);
    return this.uploads.init(req.user.id, parsed);
  }

  @Post(":id/complete")
  complete(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.uploads.complete(req.user.id, id);
  }
}
