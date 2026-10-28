# Phase 5 — Progress

**Branch:** `phase5/creative-studio`  
**Git HEAD (VPS src, 2026-10-28):** `4d3872a9`  
**Phase 5I:** **ACCEPTED**  
**Phase 5J:** **ACCEPTED**  
**Phase 5K:** **NOT ACCEPTED** (LLM configured; live smoke + agent E2E open)  
**P0 UI Recovery:** **ACCEPTED**

## Deployed staging (https://ai.shotbro.ru)

| Service | `org.shotbro.build-sha` | Image (runtime) | Notes |
|---------|-------------------------|-----------------|--------|
| Web | **4d3872a9** | `infra-web-1` | Phase 5K chat routing |
| API | **4d3872a9** | `ai-shotbro-staging-api-1` | Creative LLM + hotfixes on VPS |
| Worker | **366716e** | `ai-shotbro-staging-worker-1` | Upload processing → READY |

**Mock policy:** `AI_MOCK_MODE=true`, `PROVIDER_LIVE_EXECUTION_ENABLED=false`, `MEDIA_GENERATION_ENABLED=false` — **0 live media jobs**. OpenRouter allowed for **creative LLM only** when configured.

**VPS disk:** `/dev/vda1` **~74%** used, **~31 GB** free.

**Health:** `/api/v1/health/live` ok, `/ready` ready.

## Phase 5J sign-off evidence (`retries=0`)

**Runner:** `infra/scripts/staging-phase5j-acceptance.sh`  
**Log:** `/var/log/shotbro-e2e/phase5j-acceptance-172a4df.log`  
**Result:** **`PHASE5J_ALL_PASS`**, exit **0**

| Suite | Result |
|-------|--------|
| phase5-asset-library (6 incl. picker + IDOR) | PASS |
| regression-strict 8/8 | PASS |
| phase5-user-journey | PASS |
| phase5-storyboard | PASS |
| phase5-characters | PASS |
| phase5-references | PASS |
| phase5-creative-flow | PASS |
| phase5-timeline | PASS |
| phase5-assembly | PASS |
| phase5-prompts | PASS |
| phase5-providers | PASS |

Detail: `PHASE5-ASSET-LIBRARY-ACCEPTANCE.md`, architecture: `PHASE5-ASSET-LIBRARY-ARCHITECTURE.md`.

## Phase 5I sign-off (unchanged)

See prior table in git history; **5I remains ACCEPTED** (`6aaab0a` era). 5J full acceptance re-ran **regression-strict** and **user-journey** on current E2E checkout — not resume-skipped.

## Stage status

| Stage | Status |
|-------|--------|
| 5A–5G, 5MP | **ACCEPTED** (prior docs) |
| **5I** Timeline + FFmpeg + mock production | **ACCEPTED** |
| P0 UI Recovery | **ACCEPTED** |
| **5J** Asset Library | **ACCEPTED** |

## Remaining blockers

**Phase 5K:** live OpenRouter egress/proxy, green agent E2E, full regression queue — see `PHASE5-AGENT-INTEGRATION-ACCEPTANCE.md`.

---

## Phase 5K — Agent Integration (implementation)

**Goal:** Connect unified **AgentRuntime** / chat tools to **project assets** and **Asset Library** picks so agent turns can reference, attach, and reason about READY media without new paid provider paths.

### In scope (draft)

1. **Tool contracts:** Structured tool results that return `assetId`, `projectId`, mime, and relation hints (`STYLE`, `FIRST_FRAME`, `LAST_FRAME`, timeline clip targets) aligned with existing API — no parallel asset model.
2. **UI:** Chat blocks that surface “use in storyboard / reference / timeline” actions deep-linking into Creative sections already built in 5F–5J.
3. **Orchestrator:** Mock-only execution path unchanged; agent proposes actions → existing approval / production gates where required (5I patterns).
4. **Security:** Same session + project guards as library IDOR tests; no cross-tenant asset ids in tool payloads.
5. **Acceptance:** New Playwright suite `phase5-agent-integration` (or extend journey): mock agent attaches asset to reference + timeline, F5 persistence, regression-strict still green, `retries=0`.

### Dependencies

- **5J ACCEPTED** (library list, upload, preview, timeline binding).  
- **5I** production mock MP4 path.  
- **5E/5F** references + characters.  
- Staging mock policy unchanged until explicit product decision.

### Out of scope (5K draft)

- Live OpenRouter/Fal/Magnific/ElevenLabs billing paths  
- New MinIO buckets or public URLs  
- Replacing AssetLibraryService or upload pipeline  
- ProductionOrchestrator state machine redesign  

### Suggested milestones (implementation TBD)

| Milestone | Deliverable |
|-----------|-------------|
| 5K-A | Agent tool schema + API validation for asset ids |
| 5K-B | Chat UI asset pickers wired to agent suggestions |
| 5K-C | E2E mock agent → reference + timeline |
| 5K-D | Sign-off script entry in phase5 acceptance bundle |

**Status:** **In progress** — see `PHASE5-AGENT-INTEGRATION-ARCHITECTURE.md` and `PHASE5-AGENT-INTEGRATION-ACCEPTANCE.md`.
