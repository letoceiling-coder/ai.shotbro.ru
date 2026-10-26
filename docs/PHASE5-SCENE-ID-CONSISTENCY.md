# Phase 5I — Scene ID consistency

## Canonical rule

**One stable id per script scene**, reused everywhere:

| Layer | Field |
|-------|--------|
| Script | `scenes[].id` |
| Storyboard | `scenes[].sceneId` (= script `id`) |
| Timeline clip | `clips[].sceneId` (= storyboard `sceneId`) |
| Prompts / graph | `sceneId` on scene-scoped records |

Mock orchestrator template ids (`scene-1`, `scene-2`, `scene-3`) are **only** for greenfield mock runs with no user-authored script.

## Failure mode (fixed)

Mock agent at `SCRIPTING` / `STORYBOARDING` wrote template script/storyboard and **superseded** user UUID scenes while Timeline v2 still referenced UUID `sceneId`s → mock assembly colors fell back to dark palette.

## Guards

1. **`DrizzleProductionStorage.saveDocument`** — skip mock SCRIPT/STORYBOARD save when user script or Timeline v2 / storyboard v2 scenes exist (`packages/contracts` helpers).
2. **`ProductionOrchestrator`** — skip `SCRIPTING` / `STORYBOARDING` writes when user script or timeline v2 already present.

## Worker note

`sceneIdFromClip()` parses legacy `clipId` `scene-<uuid>` only when `clip.sceneId` is missing on old rows. Primary path is always explicit `clip.sceneId`.

## Verification

```bash
bash infra/scripts/staging-phase5i-scene-id-integration.sh
```

Expect `ok: true`, `scriptStable`, `timelineStable`, `noMockTemplate: true`.

## Helpers

`packages/contracts/src/production/scene-id-consistency.ts` — `isUserAuthoredScriptPayload`, `sceneIdChainAligned`, etc.
