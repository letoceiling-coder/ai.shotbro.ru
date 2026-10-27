import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AuthedRequest } from "../auth/session.guard";
import { SessionGuard } from "../auth/session.guard";
import { AssetsService, type AssetListQuery } from "./assets.service";

@ApiTags("assets")
@Controller("api/v1")
@UseGuards(SessionGuard)
export class AssetsController {
  constructor(@Inject(AssetsService) private readonly assets: AssetsService) {}

  @Get("projects/:projectId/assets")
  list(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
    @Query("q") q?: string,
    @Query("sort") sort?: AssetListQuery["sort"],
    @Query("filter") filter?: string,
  ) {
    return this.assets.listForProject(req.user.id, projectId, {
      limit: limit ? Number(limit) : undefined,
      cursor,
      q,
      sort,
      filter,
    });
  }

  @Get("assets/:assetId")
  detail(@Req() req: AuthedRequest, @Param("assetId") assetId: string) {
    return this.assets.getDetail(req.user.id, assetId);
  }

  @Get("assets/:assetId/preview-url")
  previewUrl(@Req() req: AuthedRequest, @Param("assetId") assetId: string) {
    return this.assets.previewUrl(req.user.id, assetId);
  }

  @Get("assets/:assetId/download-url")
  downloadUrl(@Req() req: AuthedRequest, @Param("assetId") assetId: string) {
    return this.assets.downloadUrl(req.user.id, assetId);
  }

  @Patch("assets/:assetId")
  rename(@Req() req: AuthedRequest, @Param("assetId") assetId: string, @Body() body: { originalName?: string }) {
    return this.assets.rename(req.user.id, assetId, body.originalName ?? "");
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
