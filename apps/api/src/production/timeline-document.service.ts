import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import {
  TimelineDocumentSchema,
  TimelineClipSchema,
  defaultTimelineTracks,
  computeTimelineHash,
  parseTimelineDocument,
  type TimelineDocument,
  type TimelineClip,
} from "@shotbro/contracts";
import type { Db } from "@shotbro/db/client";
import { asset, productionDocument } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { ProductionDocumentService } from "./production-document.service";
import { StoryboardDocumentService } from "./storyboard-document.service";
import { ProductionGraphService } from "./production-graph.service";

function recalcTotalDuration(doc: TimelineDocument): TimelineDocument {
  let maxEnd = 0;
  for (const track of doc.tracks) {
    for (const clip of track.clips) {
      maxEnd = Math.max(maxEnd, clip.startTimeMs + clip.durationMs);
    }
  }
  return { ...doc, totalDurationMs: maxEnd };
}

@Injectable()
export class TimelineDocumentService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
    @Inject(ProductionDocumentService) private readonly documents: ProductionDocumentService,
    @Inject(StoryboardDocumentService) private readonly storyboard: StoryboardDocumentService,
    @Inject(ProductionGraphService) private readonly graph: ProductionGraphService,
  ) {}

  async getActive(userId: string, projectId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    try {
      const row = await this.documents.getActive(userId, projectId, "TIMELINE");
      const payload = parseTimelineDocument(row.payload);
      return { ...row, payload, timelineHash: computeTimelineHash(payload) };
    } catch (e) {
      if (e instanceof Error && e.message === "legacy_timeline") {
        return null;
      }
      if ((e as { status?: number }).status === 404) return null;
      throw e;
    }
  }

  async getByVersion(userId: string, projectId: string, version: number) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const [row] = await this.db
      .select()
      .from(productionDocument)
      .where(
        and(
          eq(productionDocument.projectId, projectId),
          eq(productionDocument.docType, "TIMELINE"),
          eq(productionDocument.version, version),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Timeline version not found");
    const payload = parseTimelineDocument(row.payload);
    return { ...row, payload, timelineHash: computeTimelineHash(payload) };
  }

  private async publish(userId: string, projectId: string, doc: { id: string; version: number }, payload: TimelineDocument) {
    await this.db
      .update(productionDocument)
      .set({ status: "SUPERSEDED", updatedAt: new Date() })
      .where(eq(productionDocument.id, doc.id));
    const newId = uuid();
    const next = recalcTotalDuration(
      TimelineDocumentSchema.parse({ ...payload, revision: (payload.revision ?? 1) + 1 }),
    );
    await this.db.insert(productionDocument).values({
      id: newId,
      projectId,
      docType: "TIMELINE",
      version: doc.version + 1,
      status: "ACTIVE",
      schemaVersion: 2,
      payload: next,
      parentDocumentId: doc.id,
      createdBy: userId,
    });
    await this.graph.invalidateAssemblyForTimelineChange(userId, projectId);
    const row = await this.getActive(userId, projectId);
    return row!;
  }

  async ensureTimeline(userId: string, projectId: string) {
    const hit = await this.getActive(userId, projectId);
    if (hit) return hit;
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const [legacyRow] = await this.db
      .select()
      .from(productionDocument)
      .where(
        and(eq(productionDocument.projectId, projectId), eq(productionDocument.docType, "TIMELINE"), eq(productionDocument.status, "ACTIVE")),
      )
      .limit(1);
    if (legacyRow && legacyRow.schemaVersion !== 2) {
      const migrated = await this.syncFromStoryboard(userId, projectId, true);
      return migrated;
    }
    const payload = TimelineDocumentSchema.parse({
      schemaVersion: 2,
      format: "mp4",
      fps: 30,
      aspectRatio: "9:16",
      resolution: { width: 720, height: 1280 },
      totalDurationMs: 0,
      revision: 1,
      tracks: defaultTimelineTracks(),
      mock: true,
    });
    const id = uuid();
    await this.db.insert(productionDocument).values({
      id,
      projectId,
      docType: "TIMELINE",
      version: 1,
      status: "ACTIVE",
      schemaVersion: 2,
      payload,
      createdBy: userId,
    });
    return this.getActive(userId, projectId);
  }

  async patchDocument(userId: string, projectId: string, body: { payload: TimelineDocument; expectedRevision?: number }) {
    const current = await this.ensureTimeline(userId, projectId);
    const payload = TimelineDocumentSchema.parse(body.payload);
    if (body.expectedRevision != null && body.expectedRevision !== current!.payload.revision) {
      throw new ConflictException({ code: "timeline_revision_conflict", currentRevision: current!.payload.revision });
    }
    return this.publish(userId, projectId, current!, payload);
  }

  async previewSyncFromStoryboard(userId: string, projectId: string) {
    const board = await this.storyboard.getActive(userId, projectId);
    if (!board?.payload?.scenes?.length) throw new BadRequestException("Storyboard empty");
    const scenes = board.payload.scenes.sort((a, b) => a.order - b.order);
    const proposedClips: TimelineClip[] = scenes.map((s, idx) =>
      TimelineClipSchema.parse({
        clipId: `scene-${s.sceneId}`,
        sceneId: s.sceneId,
        assetId: undefined,
        trackId: "track-video",
        startTimeMs: scenes.slice(0, idx).reduce((sum, x) => sum + x.durationSeconds * 1000, 0),
        durationMs: Math.max(500, Math.round(s.durationSeconds * 1000)),
        order: idx,
        status: "draft",
      }),
    );
    return { sceneCount: scenes.length, proposedClips, storyboardVersion: board.version };
  }

  async syncFromStoryboard(userId: string, projectId: string, apply = true) {
    const preview = await this.previewSyncFromStoryboard(userId, projectId);
    if (!apply) return preview;
    const current = await this.ensureTimeline(userId, projectId);
    const tracks = defaultTimelineTracks();
    const video = tracks.find((t) => t.type === "VIDEO")!;
    video.clips = preview.proposedClips;
    const payload = TimelineDocumentSchema.parse({
      ...current!.payload,
      tracks,
      storyboardDocumentVersion: preview.storyboardVersion,
      revision: current!.payload.revision,
    });
    return this.publish(userId, projectId, current!, payload);
  }

  async reorderClips(userId: string, projectId: string, input: { trackId: string; clipIds: string[]; expectedRevision?: number }) {
    const current = await this.ensureTimeline(userId, projectId);
    if (input.expectedRevision != null && input.expectedRevision !== current!.payload.revision) {
      throw new ConflictException({ code: "timeline_revision_conflict", currentRevision: current!.payload.revision });
    }
    const tracks = current!.payload.tracks.map((t) => {
      if (t.id !== input.trackId) return t;
      const byId = new Map(t.clips.map((c) => [c.clipId, c]));
      const clips = input.clipIds.map((id, order) => {
        const c = byId.get(id);
        if (!c) throw new BadRequestException(`Unknown clip ${id}`);
        return { ...c, order };
      });
      let cursor = 0;
      const spaced = clips.map((c) => {
        const next = { ...c, startTimeMs: cursor };
        cursor += c.durationMs;
        return next;
      });
      return { ...t, clips: spaced };
    });
    return this.publish(userId, projectId, current!, { ...current!.payload, tracks });
  }

  async upsertClip(userId: string, projectId: string, clip: TimelineClip & { expectedRevision?: number }, expectedRevision?: number) {
    const rev = expectedRevision ?? clip.expectedRevision;
    const { expectedRevision: _drop, ...rest } = clip;
    const parsed = TimelineClipSchema.parse({ ...rest, clipId: rest.clipId ?? uuid() });
    const current = await this.ensureTimeline(userId, projectId);
    if (rev != null && rev !== current!.payload.revision) {
      throw new ConflictException({ code: "timeline_revision_conflict", currentRevision: current!.payload.revision });
    }
    const tracks = current!.payload.tracks.map((t) => {
      if (t.id !== parsed.trackId) return t;
      const idx = t.clips.findIndex((c) => c.clipId === parsed.clipId);
      const clips = idx >= 0 ? t.clips.map((c, i) => (i === idx ? parsed : c)) : [...t.clips, parsed];
      return { ...t, clips };
    });
    return this.publish(userId, projectId, current!, { ...current!.payload, tracks });
  }

  async deleteClip(userId: string, projectId: string, clipId: string, expectedRevision?: number) {
    const current = await this.ensureTimeline(userId, projectId);
    if (expectedRevision != null && expectedRevision !== current!.payload.revision) {
      throw new ConflictException({ code: "timeline_revision_conflict", currentRevision: current!.payload.revision });
    }
    const tracks = current!.payload.tracks.map((t) => ({
      ...t,
      clips: t.clips.filter((c) => c.clipId !== clipId),
    }));
    return this.publish(userId, projectId, current!, { ...current!.payload, tracks });
  }

  async validate(userId: string, projectId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const current = await this.getActive(userId, projectId);
    if (!current) return { valid: false, issues: [{ code: "no_timeline" }] };
    const issues: Array<{ code: string; clipId?: string; message?: string }> = [];
    const videoTrack = current.payload.tracks.find((t) => t.type === "VIDEO");
    const clips = [...(videoTrack?.clips ?? [])].sort((a, b) => a.order - b.order);
    let cursor = 0;
    for (const clip of clips) {
      if (clip.durationMs <= 0) issues.push({ code: "invalid_duration", clipId: clip.clipId });
      if (clip.startTimeMs < cursor && videoTrack) {
        issues.push({ code: "overlap", clipId: clip.clipId, message: "Video track overlap not supported" });
      }
      cursor = Math.max(cursor, clip.startTimeMs + clip.durationMs);
      if (clip.assetId) {
        const [row] = await this.db
          .select()
          .from(asset)
          .where(and(eq(asset.id, clip.assetId), eq(asset.projectId, projectId)))
          .limit(1);
        if (!row) issues.push({ code: "asset_not_found", clipId: clip.clipId });
        else if (!row.mimeType.startsWith("video/")) issues.push({ code: "asset_not_video", clipId: clip.clipId });
      } else if (!clip.sceneId) {
        issues.push({ code: "missing_media", clipId: clip.clipId });
      }
    }
    return { valid: issues.length === 0, issues, timelineHash: current.timelineHash, revision: current.payload.revision };
  }

  async prepareAssembly(userId: string, projectId: string) {
    const check = await this.validate(userId, projectId);
    const current = await this.getActive(userId, projectId);
    if (!current) throw new NotFoundException("Timeline missing");
    return {
      ready: check.valid,
      issues: check.issues,
      snapshot: {
        timelineDocumentId: current.id,
        timelineVersion: current.version,
        timelineHash: computeTimelineHash(current.payload),
        revision: current.payload.revision,
        totalDurationMs: current.payload.totalDurationMs,
      },
    };
  }

  /** Scene order for graph planning when timeline v2 exists. */
  async sceneOrderFromTimeline(projectId: string): Promise<string[] | null> {
    const [row] = await this.db
      .select()
      .from(productionDocument)
      .where(
        and(eq(productionDocument.projectId, projectId), eq(productionDocument.docType, "TIMELINE"), eq(productionDocument.status, "ACTIVE")),
      )
      .limit(1);
    if (!row || row.schemaVersion !== 2) return null;
    try {
      const doc = parseTimelineDocument(row.payload);
      const video = doc.tracks.find((t) => t.type === "VIDEO");
      if (!video?.clips.length) return null;
      return [...video.clips]
        .sort((a, b) => a.order - b.order)
        .map((c) => c.sceneId)
        .filter((id): id is string => Boolean(id));
    } catch {
      return null;
    }
  }
}
