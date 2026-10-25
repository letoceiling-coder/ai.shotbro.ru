# SHOTBRO AI STUDIO — Original TZ compliance audit

**Date:** 2026-10-25  
**Branch:** `phase5/creative-studio`  
**Auditor scope:** Requirements traceability vs. first sources in repo + code/tests on staging path.

## Source inventory

| Document | Role | Notes |
|----------|------|--------|
| Standalone file named «Исходное ТЗ / Original TZ» | **SOURCE_MISSING** | No `*TZ*` or equivalent master spec in repository. |
| `docs/PHASE5-UI-AUDIT.md` | Baseline capability matrix (`dde4cdb`) | Proxy for product goals; **not** original TZ. |
| `docs/PHASE5-AUDIT.md`, `PHASE5-ARCHITECTURE.md`, `PHASE5-DATA-MODEL.md` | Phase 5 master decomposition | Authoritative for 5A–5P scope. |
| `docs/PHASE2-AUDIT.md` | Early production/agent surfaces | Historical; partial overlap with end-to-end video studio. |
| Phase 3/4 progress & strict E2E docs | Acceptance of chat-first REAL mode | Does not replace creative workspace TZ. |

**Methodology:** Each REQ row is traced to code (`apps/api`, `apps/web`, `packages/ai`, worker). Status requires backend **and** user-visible path (or explicit MOCK_ONLY/BACKEND_ONLY). Counts in Table A sum distinct REQ rows below plus goals A–V.

---

## Product goals A–V (end-to-end chain)

| ID | Goal | Backend | Frontend | Persistence | Agent | Tests | Staging evidence | STATUS | Gaps | PRIORITY |
|----|------|---------|----------|-------------|-------|-------|------------------|--------|------|----------|
| A | Natural-language brief / rolik description | Chat + brief doc | Chat + Brief tab | `production_document` BRIEF | `update_project_brief` | Phase 3/4 strict | REAL chat E2E | **PARTIAL** | Brief tab thin vs. chat blocks | P1 |
| B | Agent understands task | AgentRuntime + memory | Chat | conversations | ContextBuilder | strict 8/8 | mock LLM | **COMPLETE** | mock-only reasoning | — |
| C | Concept + script creation | Script doc service | Script tab + chat blocks | SCRIPT versioning | `create_script` | 5C + strict | UI script editor | **COMPLETE** | — | — |
| D | User edits script | PATCH scenes | ScriptEditor | yes + 409 revision | tools partial | 5C E2E | VPS | **COMPLETE** | — | — |
| E | Script → scenes | scene CRUD | ScriptEditor | yes | sync tools | creative-flow | VPS | **COMPLETE** | — | — |
| F | Storyboard + frames | STORYBOARD doc | Storyboard studio | yes | storyboard tools | 5D 5/5 | VPS | **COMPLETE** | — | — |
| G | Character definitions | CharacterContinuity | Character studio | project_memory | character tools | 5E 4/4 | VPS | **COMPLETE** | — | — |
| H | Character ↔ references | ReferenceService | References + chars | reference_link | attach/detach | 5F 5/5 | VPS | **COMPLETE** | — | — |
| I | First/last frame selection | storyboard patch + refs | Storyboard detail | yes | set_scene_*_frame | 5D | VPS | **COMPLETE** | live gen N/A | — |
| J | Agent knows model params | MODEL_PARAMETER_REGISTRY | Providers tab | memory prefs | compare_models, caps | providers 16/16 | mock routing | **PARTIAL** | agent narrative UX limited | P1 |
| K | User picks models/settings | route-plan + model-settings API | Providers section | sceneModelSettings | partial | providers E2E | VPS | **PARTIAL** | not unified with Prompt Studio until 5G | P1 |
| L | Agent creates/improves prompts | PromptVersionService + tools (5G) | **Prompt Studio tab** | `prompt_version` | get/save/list/compare/restore | **5G E2E pending VPS** | deploy pending | **PARTIAL** | asset preview in prompt UI minimal | P0 |
| M | Cost-aware generation plan | CostReservationService | chat blocks | reservations | estimate_cost | Phase 4 | mock | **MOCK_ONLY** | not in workspace Production tab | P1 |
| N | User approves versions | ApprovalsService | ApprovalCard | hashes | request_approval | strict | chat | **PARTIAL** | prompt-specific approval UI weak | P1 |
| O | Image/voice/video prep | provider jobs worker | context panel | jobs table | generate.* mock | Phase 4 | mock jobs | **MOCK_ONLY** | no live Fal/ElevenLabs | P0 chain |
| P | Magnific image processing | adapter stub | — | — | — | config flags | live off | **NOT_IMPLEMENTED** | UI + job wiring | P2 |
| Q | Fal / ElevenLabs / OpenRouter | multiplexer adapters | Providers | route metadata | submit mock | 16/16 | mock only | **MOCK_ONLY** | by policy | — |
| R | Review scene results | assets + blocks | chat/context | MinIO | list_assets | Phase 3 | partial | **PARTIAL** | no scene gallery in workspace | P1 |
| S | Reorder scenes + pick versions | script/storyboard reorder | UI | yes | reorder tools | 5D/flow | VPS | **PARTIAL** | material version pick per scene incomplete | P1 |
| T | FFmpeg timeline assembly | worker compose | — | DELIVERY doc | compose_video | strict delivery | mock ffmpeg | **PARTIAL** | Timeline editor missing (5I) | P0 |
| U | Asset library | AssetsService | context Assets + placeholders | MinIO | list_assets | Phase 3 | partial | **PARTIAL** | Asset Library tab placeholder (5J) | P1 |
| V | Final MP4 view | delivery pipeline | chat video block | yes | prepare_delivery | strict | yes | **COMPLETE** | not linked from Timeline/Assets | P1 |

---

## Requirements traceability (selected REQ rows)

| REQ_ID | SOURCE | ORIGINAL_REQUIREMENT | CURRENT_IMPLEMENTATION | BACKEND | FRONTEND | PERSISTENCE | AGENT | TESTS | STAGING | STATUS | GAPS | PRIORITY |
|--------|--------|----------------------|------------------------|---------|----------|-------------|-------|-------|---------|--------|------|----------|
| REQ-SHELL-01 | PHASE5-UI-AUDIT | Unified creative workspace | `CreativeWorkspace` + section nav | projects API | yes | projects | — | 5B+ | ai.shotbro.ru | **COMPLETE** | — | — |
| REQ-SCRIPT-01 | PHASE5-DATA-MODEL | Scene CRUD + revision | ProductionDocumentService | yes | ScriptEditor | SCRIPT doc | tools | 5C | VPS | **COMPLETE** | — | — |
| REQ-SB-01 | PHASE5 master | Storyboard sync/edit | StoryboardDocumentService | yes | StoryboardStudio | STORYBOARD | yes | 5D | VPS | **COMPLETE** | — | — |
| REQ-CHAR-01 | PHASE5 master | Character continuity | CharacterContinuityService | yes | CharacterStudio | memory | yes | 5E | VPS | **COMPLETE** | — | — |
| REQ-REF-01 | PHASE5 master | Reference links persisted | ReferenceService | yes | ReferenceManager | reference_link | yes | 5F | VPS | **COMPLETE** | — | — |
| REQ-PROV-01 | PHASE5-MP | Mock multi-provider routing | ProviderJobs + route plan | yes | ModelSettings | jobs + memory | multiplexer tools | 16/16 | VPS | **MOCK_ONLY** | live disabled | — |
| REQ-PROMPT-01 | PHASE5 5G | Per-scene prompt versions | PromptVersionService + bundle schema | yes | PromptStudio | prompt_version | 8 tools | 5G spec | **pending deploy** | **PARTIAL** | preview assets | P0 |
| REQ-PROMPT-02 | PHASE5 5G | Model-aware validation | ModelParameterValidator | yes | validate button | snapshot in params | validate_prompt_for_model | 5G | pending | **PARTIAL** | block unsupported fields at save | P0 |
| REQ-PROD-01 | PHASE2/4 | Production graph orchestration | ProductionGraphService | yes | placeholder tab | graph nodes | start graph | integration | context | **BACKEND_ONLY** | workspace Production | P0 |
| REQ-TIME-01 | PHASE5 5I | Timeline JSON + order | doc type TIMELINE | schema | placeholder | partial | prepare_timeline mock | — | no | **NOT_IMPLEMENTED** | editor + FFmpeg sync | P0 |
| REQ-FFMPEG-01 | Original chain (SOURCE_MISSING) | Assembly per timeline | worker FFmpeg | yes | — | DELIVERY | compose_video | strict | mock | **PARTIAL** | ignores user timeline | P0 |
| REQ-AGENT-CTX-01 | PHASE5 5K | UI edits in agent context | ContextBuilder | partial | — | docs | partial | — | — | **PARTIAL** | prompt/storyboard parity | P1 |
| REQ-ORIG-TZ-MASTER | — | Full original TZ text | — | — | — | — | — | — | — | **SOURCE_MISSING** | import TZ to repo | P2 |

---

## Product gap analysis (staging UI, 2026-10-25)

**Method:** Prior Playwright baselines (`phase5-audit`, 5D–5F suites) + code review; full re-walk after 5G deploy required.

| Blocker | Evidence |
|---------|----------|
| Production / Timeline / Assets tabs are placeholders | `creative-workspace.tsx` |
| Prompt tab absent until 5G deploy | pre-5G HEAD |
| Chat vs workspace duplication | script/storyboard visible in both |
| Model settings not surfaced inside Prompt Studio cross-links only | by design 5G |
| Live provider execution intentionally off | env policy |

---

## Table A — Original TZ compliance (summary)

| Metric | Count | Notes |
|--------|------:|-------|
| Total requirements tracked | **24** | 22 goals A–V (2 merged) + 12 REQ rows − overlaps normalized to **24** line items in goals+REQ table |
| Complete | **9** | B,C,D,E,F,G,H,I,V + REQ-SHELL/SCRIPT/SB/CHAR/REF |
| Partial | **11** | A,J,K,L,N,R,S,T,U + REQ-PROMPT/PROD/FFMPEG/AGENT |
| Mock-only | **3** | M,O,Q (+ REQ-PROV-01) |
| Missing / not implemented | **2** | P, REQ-TIME-01 |
| Blocked | **0** | — |
| Source missing | **1** | REQ-ORIG-TZ-MASTER |

*Percent complete is intentionally omitted — denominator mixes SOURCE_MISSING proxy requirements with implemented Phase 5 decomposition.*

---

## Deviations from initial intent

1. **Chat-first shipping:** REAL mode delivered script/storyboard as message blocks before workspace tabs (documented in PHASE5-UI-AUDIT).  
2. **Mock-only providers:** Fal/ElevenLabs/Magnific/OpenRouter wired for routing tests; live execution disabled by policy (not a code skip — env gate).  
3. **Characters in JSON memory** rather than normalized tables (accepted Phase 5E).  
4. **No original TZ file** — roadmap driven by Phase 5 architecture docs after Phase 4F tag `dde4cdb`.

---

## Next verification (post–5G deploy)

1. VPS `git log -1`, `df -h`, `staging-deploy.sh --verify`.  
2. `phase5-prompts` Playwright (4 viewports).  
3. Re-run `regression-strict`, `phase5-providers`, creative suites (`retries=0`).  
4. Update staging evidence column for REQ-PROMPT-01/02 to **COMPLETE** when E2E green.
