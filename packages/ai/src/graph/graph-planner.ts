import { createHash } from "node:crypto";

export type GraphNodePlan = {
  id: string;
  nodeType: string;
  dependencies: string[];
  sceneId?: string;
  versionHash: string;
};

export type SceneVersionRefs = {
  promptVersion?: number;
  characterVersion?: number;
  sceneRevision?: number;
};

export function sceneGraphVersionHash(
  baseHash: string,
  sceneId: string,
  refs: SceneVersionRefs = {},
): string {
  return hashParts([
    baseHash,
    sceneId,
    refs.sceneRevision ?? 1,
    refs.promptVersion ?? 0,
    refs.characterVersion ?? 0,
  ]);
}

export function planProductionGraph(input: {
  runId: string;
  sceneIds: string[];
  scriptVersion: number;
  storyboardVersion: number;
  sceneVersions?: Record<string, SceneVersionRefs>;
}): GraphNodePlan[] {
  const baseHash = hashParts([input.runId, input.scriptVersion, input.storyboardVersion]);
  const nodes: GraphNodePlan[] = [
    { id: `${input.runId}:brief`, nodeType: "BRIEF", dependencies: [], versionHash: baseHash },
    { id: `${input.runId}:script`, nodeType: "SCRIPT", dependencies: [`${input.runId}:brief`], versionHash: baseHash },
    {
      id: `${input.runId}:storyboard`,
      nodeType: "STORYBOARD",
      dependencies: [`${input.runId}:script`],
      versionHash: baseHash,
    },
  ];

  for (const sceneId of input.sceneIds) {
    const sceneHash = sceneGraphVersionHash(baseHash, sceneId, input.sceneVersions?.[sceneId]);
    const promptId = `${input.runId}:image_prompt:${sceneId}`;
    const imageId = `${input.runId}:image:${sceneId}`;
    const videoId = `${input.runId}:video:${sceneId}`;
    nodes.push(
      {
        id: promptId,
        nodeType: "IMAGE_PROMPT",
        dependencies: [`${input.runId}:storyboard`],
        sceneId,
        versionHash: sceneHash,
      },
      { id: imageId, nodeType: "IMAGE_GENERATION", dependencies: [promptId], sceneId, versionHash: sceneHash },
      { id: videoId, nodeType: "VIDEO_GENERATION", dependencies: [imageId], sceneId, versionHash: sceneHash },
    );
  }

  const voiceId = `${input.runId}:voiceover`;
  const timelineId = `${input.runId}:timeline`;
  const assemblyId = `${input.runId}:assembly`;
  const qcId = `${input.runId}:qc`;
  const deliveryId = `${input.runId}:delivery`;

  const videoDeps = input.sceneIds.map((s) => `${input.runId}:video:${s}`);
  nodes.push(
    { id: voiceId, nodeType: "VOICEOVER", dependencies: [`${input.runId}:script`], versionHash: baseHash },
    { id: timelineId, nodeType: "TIMELINE", dependencies: [...videoDeps, voiceId], versionHash: baseHash },
    { id: assemblyId, nodeType: "ASSEMBLY", dependencies: [timelineId], versionHash: baseHash },
    { id: qcId, nodeType: "QUALITY_CHECK", dependencies: [assemblyId], versionHash: baseHash },
    { id: deliveryId, nodeType: "DELIVERY", dependencies: [qcId], versionHash: baseHash },
  );

  assertAcyclic(nodes);
  return nodes;
}

export function invalidateSceneDependents(
  nodes: GraphNodePlan[],
  changedSceneId: string,
  runId: string,
): string[] {
  const prefix = `${runId}:`;
  const affected = new Set<string>();
  for (const n of nodes) {
    if (n.sceneId === changedSceneId || n.id.startsWith(`${prefix}image`) && n.sceneId === changedSceneId) {
      affected.add(n.id);
    }
  }
  const invalidate = (id: string) => {
    for (const n of nodes) {
      if (n.dependencies.includes(id)) {
        if (!affected.has(n.id)) {
          affected.add(n.id);
          invalidate(n.id);
        }
      }
    }
  };
  for (const id of [...affected]) invalidate(id);
  if (affected.size > 0) {
    for (const n of nodes) {
      if (n.nodeType === "ASSEMBLY" || n.nodeType === "DELIVERY" || n.nodeType === "TIMELINE") affected.add(n.id);
    }
  }
  return [...affected];
}

function hashParts(parts: (string | number)[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

function assertAcyclic(nodes: GraphNodePlan[]) {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const dfs = (id: string) => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error("Production graph cycle detected");
    visiting.add(id);
    const node = byId.get(id);
    for (const dep of node?.dependencies ?? []) dfs(dep);
    visiting.delete(id);
    visited.add(id);
  };

  for (const n of nodes) dfs(n.id);
}
