# VPS shared storage recovery — 85.117.235.93

**Audit date:** 2026-10-25  
**Host disk:** `/dev/vda1` ext4 **116 GiB**

## Executive summary

Minimal SHOTBRO deploy fixed **tag churn** (~GB), not **platform-wide layer storage**. Most bytes live in **containerd** (Docker image/layer store) and **BuildKit cache** shared by Dify, parser, studio-shotbro, and SHOTBRO. Summing `docker system df` image sizes **double-counts shared layers**; physical usage is measured with **`du`** on `/var/lib/containerd`.

**Recovery action (2026-10-25):** `docker builder prune -f --keep-storage 8GB` reclaimed **~35 GiB** (BuildKit). **No volumes, PG, MinIO, or co-tenant images removed.**

| Metric | Before audit | After BuildKit GC |
|--------|----------------|-------------------|
| **Used / free** | **98 GiB / 19 GiB (85%)** | **65 GiB / 51 GiB (57%)** |
| **`du /var/lib/containerd`** | **~63 GiB** | **~30 GiB** |
| **`du /var/lib/docker`** | **~2.7 GiB** | **~34 GiB** (buildkit dir; cache accounting shifted) |
| Build cache (docker df) | 42.4 GiB (2.4 GiB “reclaimable”) | **7.4 GiB** |
| SHOTBRO services | — | **web_ok, api_ok** |

---

## A. TOP-20 actual consumers (`du -x`, same filesystem)

| Rank | Path | ~Size | Role |
|------|------|-------|------|
| 1 | `/` | 98→65 GiB | Total |
| 2 | `/var/lib/containerd` | 63→30 GiB | **Docker/containerd layers (all projects)** |
| 3 | `…/overlayfs/snapshots` | 57→25 GiB | Active + referenced image layers |
| 4 | `…/content/blobs` | 5.6 GiB | Content-addressable blobs |
| 5 | `/usr/share/ollama` | 11 GiB | Host LLM weights |
| 6 | `/usr/local/lib/ollama` | 4.7 GiB | Ollama runtime |
| 7 | `/var/www` | 4.1 GiB | Site trees |
| 8 | `/var/lib/mysql` | 3.5 GiB | Host MariaDB (`sadavod_parser` DB ~3 GiB) |
| 9 | `/var/lib/docker` | 2.7→34 GiB | Logs, volumes meta, **buildkit** |
| 10 | `/tmp` | 1.6 GiB | Temp ( **`/tmp/gpt-ci-test` ~1.1 GiB** ) |
| 11 | `/usr` (rest) | ~3 GiB | System |
| 12 | `ai.shotbro.ru-src` | 980 MiB | Git + host `node_modules` (E2E) |
| 13 | `/var/log` | 481 MiB | journald, nginx, docker json logs |
| 14 | `/var/cache` | 313 MiB | apt etc. |
| 15 | SHOTBRO staging PG volume | ~87 MiB | User DB |
| 16 | SHOTBRO staging MinIO volume | ~37 MiB | User assets |
| 17 | `model-apishotbroru_qdrant_data` | ~550 MiB | Unlinked volume (0 links) |
| 18 | `docker_mysql_data` volume | ~197 MiB | Unlinked |
| 19 | `ragflow_mysql_data` | ~232 MiB | Unlinked |
| 20 | Playwright image (logical) | 3.38 GiB | **0 running containers**; kept for E2E |

**containerd metadata:** moby namespace **358 snapshots**, **361 content** objects (read-only `ctr -n moby …`).

---

## B. Active container resources (by project)

| Project | Containers | Key images (ID prefix) | Notes |
|---------|------------|-------------------------|--------|
| **SHOTBRO ai.shotbro.ru** | `infra-web-1`, `ai-shotbro-staging-api-1`, `ai-shotbro-staging-worker-1`, PG, Redis, MinIO | `722cfab`, `892ded0`, `fb2d45ea` | Tags: `shotbro/{web,api,worker}:current`, `web:rollback` |
| **studio-shotbro** | web, api, worker, PG, Redis, MinIO | `1198317`, `1bc3b00`, `8e51b1f2` | Separate stack |
| **Dify** | api×4, web, worker, sandbox, plugin, nginx, weaviate, ssrf, pg, redis | `062815df` (4.12 GiB logical) | All **Up** |
| **parser-site-rag** | api, celery×2, crawl4ai, scrapy, findpapers, pg, redis, prometheus, proxy | Shared **2.058 GiB** celery base | All **Up** |
| **Other** | neeklo-brain, shotbro-budget-test-pg | qdrant, redis, postgres | budget PG = test? |

**Stopped containers:** **0** (nothing to remove via `container rm`).

---

## C. Unused but protected (do not auto-delete)

| Resource | Size | Why protected |
|----------|------|----------------|
| `mcr.microsoft.com/playwright:v1.64.1-jammy` | 3.38 GiB logical | VPS E2E runner |
| `shotbro/web:rollback` | 330 MiB (shared layers) | Rollback policy |
| All Dify/parser/studio images | ~40+ GiB logical (shared) | **BLOCKED_OWNER_APPROVAL** |
| Ollama models (5 tags, duplicates llama3) | ~11 GiB + 4.7 GiB runtime | **BLOCKED_OWNER_APPROVAL** |
| Host MariaDB | 3.5 GiB | Non-Docker DB |
| Unlinked Docker volumes (569 MiB reclaimable in df) | various | **No `volume prune`** — may be old projects |

---

## D. Confirmed removable SHOTBRO (allowlist)

| Action | Reclaim | Done? |
|--------|---------|-------|
| Legacy `shotbro-web-build:*` tags | Tag-only | Yes (prior minimal deploy) |
| Duplicate tags `infra-web:*`, `ai-shotbro-staging-*:latest` | Tag-only | Yes 2026-10-25 |
| Unused `node:22-alpine` | ~62 MiB unique | Yes (deleted) |
| `standalone.bak-*` | ~100 MiB | Yes (prior cleanup) |
| **BuildKit cache above 8 GiB keep** | **~35 GiB physical** | **Yes** (`docker builder prune --keep-storage 8589934592`) |

**Not removed:** PG/MinIO/Redis volumes, Playwright image, co-tenant images.

---

## E. Co-tenant — requires owner approval

| Item | Est. footprint | Risk if removed |
|------|----------------|-----------------|
| Dify stack images | ~10–12 GiB unique layers (4.12 GiB dify-api alone) | Production AI platform down |
| Parser RAG (3×2.78 GiB celery family) | ~4–6 GiB net shared | Parser down |
| studio-shotbro stack | ~3 GiB net | studio.shotbro.ru down |
| Ollama llama3/mistral duplicates | Up to **~16 GiB** | Local LLM apps break |
| `/tmp/gpt-ci-test` | **~1.1 GiB** | Unknown CI owner |
| Unlinked volumes (qdrant, ragflow mysql, docker_mysql) | **~1 GiB** | Data loss if wrong volume |

Report file: `/var/log/shotbro-cotenant-recovery.txt` (`staging-cotenant-docker-report.sh`).

---

## F. Actual reclaimed GiB

| Step | Δ free (approx.) |
|------|------------------|
| Prior SHOTBRO minimal deploy + dangling prune | ~7 GiB (98→91% era) |
| **BuildKit prune keep 8 GiB** | **~33 GiB** (98→65 GiB used) |
| **Total session** | **~51 GiB free** (from ~11–19 GiB) |

Always verify with **`df -h /`**, not summed `docker images` sizes.

---

## G. Remaining disk (post-recovery)

- **~51 GiB free (57% used)**
- **~30 GiB containerd** + **~34 GiB `/var/lib/docker`** (includes retained **~7.4 GiB** build cache per `docker system df`)
- **~16 GiB Ollama** still on host
- **~3.5 GiB MariaDB** on host

---

## H. Preventive changes

1. **Default `BUILD_CACHE_KEEP_GB=8`** in `staging-shotbro-common.sh` (post-deploy GC).
2. **`staging-disk-daily-snapshot.sh`** → `/var/log/shotbro-disk-daily.jsonl` (cron 04:05).
3. **Why old GC freed little:** `docker system df` showed **2.4 GiB reclaimable** cache while **42 GiB total** cache was mostly **referenced** until `keep-storage` eviction; image **tag** removal does not drop shared layers still used by **37 running containers**.
4. **Why minimal SHOTBRO deploy alone did not shrink disk:** SHOTBRO unique runtime is **~4 GiB** (web+api+worker); the **63 GiB containerd** blob store is **multi-tenant**.
5. **Next web/api/worker build:** expect cache growth; run **`staging-safe-cleanup.sh --confirm`** or automatic post-deploy `shotbro_gc_images` (includes builder keep).

---

## Why not `docker system prune -af`

Would target **62 GiB “reclaimable” images** in df — mostly **still tagged and used** by Dify/parser/studio. Only **BuildKit keep-storage** was safe without owner approval.

---

## Security / data

- No PostgreSQL/MinIO/Redis data deleted.
- No live AI calls.
- No secrets in logs.

**Phase 5G:** defer until disk policy acknowledged and daily snapshots confirm stable free space.
