import { Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AuthedRequest } from "../auth/session.guard";
import { SessionGuard } from "../auth/session.guard";
import { AssetsService } from "./assets.service";

@ApiTags("assets")
@Controller("api/v1")
@UseGuards(SessionGuard)
export class AssetsController {
  constructor(@Inject(AssetsService) private readonly assets: AssetsService) {}

  @Get("projects/:projectId/assets")
  list(@Req() req: AuthedRequest, @Param("projectId") projectId: string) {
    return this.assets.listForProject(req.user.id, projectId);
  }

  @Get("assets/:assetId/download-url")
  downloadUrl(@Req() req: AuthedRequest, @Param("assetId") assetId: string) {
    return this.assets.downloadUrl(req.user.id, assetId);
  }

  @Get("assets/:assetId/versions")
  versions(@Req() req: AuthedRequest, @Param("assetId") assetId: string) {
    return this.assets.listVersions(req.user.id, assetId);
  }

  @Post("assets/:assetId/delete")
  softDelete(@Req() req: AuthedRequest, @Param("assetId") assetId: string) {
    return this.assets.softDelete(req.user.id, assetId);
  }

  @Post("assets/:assetId/restore")
  restore(@Req() req: AuthedRequest, @Param("assetId") assetId: string) {
    return this.assets.restore(req.user.id, assetId);
  }
}
