# Phase 5L — Acceptance plan

**Status:** PLANNED — not executed  
**Baseline:** Git `ea19bd2`, Phase 5K ACCEPTED  
**Policy:** Staging remains **mock media**; **no live paid** image/video jobs during 5L acceptance.

---

## 1. ACCEPTED definition

Phase 5L is **ACCEPTED** when **all** of the following hold on VPS staging (`85.117.235.93` or successor):

1. Git deploy SHA for **API/Web** matches acceptance commit (Worker unchanged unless 5L scope expands).
2. **`PHASE5L_ALL_PASS`** emitted by sequential acceptance script (exit 0).
3. **5K regression smokes** still pass (no guard regression).
4. **`regression-strict`** 8/8 pass (retries=0).
5. Evidence logged under `/var/log/shotbro-e2e/` with git short SHA in filename.
6. Docs updated: `PHASE5-PROGRESS.md`, `PHASE5L-*`, final acceptance checklist item for mock-complete product.

---

## 2. Acceptance script (to implement in 5L)

Add **`infra/scripts/phase5l-acceptance-e2e.sh`** (sequential, no parallel Playwright):

```bash
# Order (proposed)
phase5-agent-integration      # 5K baseline
regression-strict             # production bootstrap chain
phase5-unified-studio         # NEW — 5L primary spec
phase5-user-journey           # long journey + F5
phase5-assembly               # timeline + mock MP4
phase5-brief-smoke            # NEW — brief tab (5L-8)
# optional spot checks:
phase5-timeline               # if unified spec does not cover F5 timeline
echo "PHASE5L_ALL_PASS sha=${SHA} $(date -Is)"
```

Until `phase5-unified-studio.spec.ts` exists, **ACCEPTED cannot be claimed**.

---

## 3. New E2E: `phase5-unified-studio.spec.ts` (criteria)

**File:** `apps/web/e2e/phase5-unified-studio.spec.ts`  
**Projects:** desktop (required), tablet (required), mobile (smoke nav only).

| # | Scenario | Assert |
|---|----------|--------|
| U1 | REAL project pin survives F5 on **chat** section | `pinRealProjectOnReload`; after reload `real-thread` visible |
| U2 | Production bootstrap message → brief/plan blocks without creative-turn hijack | API messages contain `generation_plan`; no stuck 180s wait (`agent-waits.ts` patterns) |
| U3 | `creative-turn` (mock `phase5k:`) mutates storyboard; **without manual tab click** storyboard query shows `firstFrameAssetId` after invalidation (5L-4) | Poll API or open storyboard with auto-nav if flag on |
| U4 | After mock production completes, **Production** tab shows playable/downloadable MP4 (`mock-delivery`) | `production-section.tsx` + asset poll |
| U5 | Chat **`video_result`** block has **non-empty** playable URL (5L-6) | Block payload `url` or preview link |
| U6 | Scene/provider job gallery shows ≥1 mock job row after production (5L-7) | testid `scene-job-row-*` or API poll |
| U7 | Duplicate `creative-turn` with same `idempotencyKey` → single storyboard mutation (5L-3) | API integration or E2E double-submit |

Timeout budget: ≤15 min desktop; full suite sequential ≤90 min.

---

## 4. Existing suites (must remain green)

| Suite | Mode | Pass criterion |
|-------|------|----------------|
| `phase5k-media-guard-smoke.sh` | vitest | `PHASE5K_MEDIA_GUARD_PASS` |
| `phase5k-live-llm-smoke.sh` | integration | `PHASE5K_LIVE_LLM_SMOKE_PASS` (minimal OpenRouter spend) |
| `phase5k-live-mutation-smoke.sh` | integration | `PHASE5K_LIVE_MUTATION_SMOKE_PASS` |
| `regression-strict` | Playwright | 8 passed |
| `phase5-agent-integration` | Playwright | 2 passed |

---

## 5. Security & idempotency tests

| Test | File | Requirement |
|------|------|-------------|
| Project isolation | `security-isolation.integration.spec.ts` | No regression |
| Upload IDOR | `upload-idor.integration.spec.ts` | No regression |
| Creative-turn idempotency | **NEW** `phase5l-creative-idempotency.integration.spec.ts` | Duplicate POST → 200 same body, one DB mutation count |
| Media guard unit | `phase5k-media-guard.spec.ts` | Still blocks `generate.video` |

---

## 6. Manual QA checklist (pre-ACCEPTED)

| Check | Viewport |
|-------|----------|
| Login → REAL → create project | desktop |
| Send bootstrap production NL | desktop |
| Approve through to MP4 | desktop |
| Switch tablet: create project + chat send | tablet |
| Asset upload READY + library F5 | desktop |
| No DEMO data mixed into REAL project list | desktop |

---

## 7. Log artifacts

| Log | Content |
|-----|---------|
| `/var/log/shotbro-e2e/phase5l-acceptance-<sha>.log` | Full sequential run |
| `/var/log/shotbro-e2e/phase5-unified-studio-<sha>.log` | Optional per-mode tee |

Must contain line: **`PHASE5L_ALL_PASS sha=<short-sha> <iso8601>`**

---

## 8. Non-goals during acceptance run

- Do **not** set `MEDIA_GENERATION_ENABLED=true` on staging.
- Do **not** run parallel Playwright workers against same staging URL.
- Do **not** delete user projects / MinIO buckets / Postgres volumes.

---

## 9. Rollback

If 5L acceptance fails:

1. API/Web rollback via `shotbro/api:rollback` / web rollback labels (`staging-deploy-staging-stack.sh` promotion model).
2. Git revert on branch; redeploy previous SHA.
3. Re-run 5K acceptance log comparison.

---

## 10. Sign-off table (template)

| Role | Check | Date | SHA |
|------|-------|------|-----|
| Engineering | `PHASE5L_ALL_PASS` | | |
| QA | Unified spec + regression | | |
| Product | Mock-complete journey demo | | |
| Security | IDOR + media guard | | |

---

## 11. Mapping audit findings → acceptance

| Audit ID (product doc) | Acceptance test |
|------------------------|-----------------|
| Split agent / routing | U2, regression-strict |
| Workspace desync | U3 |
| Empty delivery URL | U4, U5 |
| No scene gallery | U6 |
| creative-turn idempotency gap | U7 + integration spec |
| Brief untested | `phase5-brief-smoke` |
| Assembly UI-only API | `phase5-assembly` + 5L-9 button test (when added) |
