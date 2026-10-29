import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { MediaCapabilitySchema } from "@shotbro/contracts";
import type { AuthedRequest } from "../auth/session.guard";
import { SessionGuard } from "../auth/session.guard";
import { TalentService } from "./talent.service";
import { TalentJobsService } from "./talent-jobs.service";

/** Phase 6A/6B: reusable avatars and voices (workspace scope) + talent operations (mock until 6C approvals). */
@ApiTags("talent")
@Controller("api/v1")
@UseGuards(SessionGuard)
export class TalentController {
  constructor(
    @Inject(TalentService) private readonly talent: TalentService,
    @Inject(TalentJobsService) private readonly jobs: TalentJobsService,
  ) {}

  /** Phase 6B: clone / design / save voice, train avatar. Mock mode only until 6C approvals. */
  @Post("talent/operations")
  startOperation(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.jobs.start(req.user.id, body);
  }

  @Get("talent/jobs/:jobId")
  getJob(@Req() req: AuthedRequest, @Param("jobId") jobId: string) {
    return this.jobs.get(req.user.id, jobId);
  }

  @Get("talent/provider-chain")
  providerChain(@Query("capability") capability: string) {
    const parsed = MediaCapabilitySchema.safeParse(capability);
    if (!parsed.success) throw new BadRequestException({ code: "invalid_capability" });
    return this.talent.providerChain(parsed.data);
  }

  @Get("voices/library")
  libraryVoices() {
    return this.talent.libraryVoices();
  }

  @Get("voices")
  listVoices(@Req() req: AuthedRequest, @Query("archived") archived?: string) {
    return this.talent.listVoices(req.user.id, { includeArchived: archived === "true" });
  }

  @Post("voices")
  createVoice(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.talent.createVoice(req.user.id, body);
  }

  @Get("voices/:voiceId")
  getVoice(@Req() req: AuthedRequest, @Param("voiceId") voiceId: string) {
    return this.talent.getVoice(req.user.id, voiceId);
  }

  @Patch("voices/:voiceId")
  updateVoice(@Req() req: AuthedRequest, @Param("voiceId") voiceId: string, @Body() body: unknown) {
    return this.talent.updateVoice(req.user.id, voiceId, body);
  }

  @Delete("voices/:voiceId")
  archiveVoice(@Req() req: AuthedRequest, @Param("voiceId") voiceId: string) {
    return this.talent.archiveVoice(req.user.id, voiceId);
  }

  @Post("voices/:voiceId/consent")
  voiceConsent(@Req() req: AuthedRequest, @Param("voiceId") voiceId: string, @Body() body: unknown) {
    return this.talent.attachVoiceConsent(req.user.id, voiceId, body);
  }

  @Get("avatars")
  listAvatars(@Req() req: AuthedRequest, @Query("archived") archived?: string) {
    return this.talent.listAvatars(req.user.id, { includeArchived: archived === "true" });
  }

  @Post("avatars")
  createAvatar(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.talent.createAvatar(req.user.id, body);
  }

  @Get("avatars/:avatarId")
  getAvatar(@Req() req: AuthedRequest, @Param("avatarId") avatarId: string) {
    return this.talent.getAvatar(req.user.id, avatarId);
  }

  @Patch("avatars/:avatarId")
  updateAvatar(@Req() req: AuthedRequest, @Param("avatarId") avatarId: string, @Body() body: unknown) {
    return this.talent.updateAvatar(req.user.id, avatarId, body);
  }

  @Delete("avatars/:avatarId")
  archiveAvatar(@Req() req: AuthedRequest, @Param("avatarId") avatarId: string) {
    return this.talent.archiveAvatar(req.user.id, avatarId);
  }

  @Post("avatars/:avatarId/consent")
  avatarConsent(@Req() req: AuthedRequest, @Param("avatarId") avatarId: string, @Body() body: unknown) {
    return this.talent.attachAvatarConsent(req.user.id, avatarId, body);
  }

  @Patch("projects/:projectId/characters/:characterId/talent")
  assignToCharacter(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Param("characterId") characterId: string,
    @Body() body: unknown,
  ) {
    return this.talent.assignToCharacter(req.user.id, projectId, characterId, body);
  }
}
