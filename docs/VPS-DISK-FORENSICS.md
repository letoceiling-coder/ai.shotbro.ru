# VPS disk forensics — ai.shotbro.ru staging host

**Host:** `root@85.117.235.93`  
**Audit date:** 2026-10-25  
**Disk:** `/dev/vda1` ext4 **116G** total  

## BEFORE (read-only audit)

| Metric | Value |
|--------|--------|
| Used | **105G (91%)** |
| Free | **~11G** |
| `/var` | **82G** |
| `/var/lib/containerd` | **69G** (63G overlay snapshots + 7G content blobs) |
| `/var/lib/docker` (du) | **2.7G** (containers logs ~1.1G json-file; buildkit dir ~711M) |
| Docker **Images** (system df) | **73.79GB** total, **62.12GB (84%) reclaimable** |
| Docker **Build cache** | **42.41GB** (70 entries) |
| `/usr/share/ollama` models | **~11G** (host, not Shotbro) |
| `/usr/local/lib/ollama` | **~4.7G** |
| `/var/lib/mysql` | **3.5G** (host MariaDB, not staging PG volume) |
| `/var/www/ai.shotbro.ru-src` | **980M** (962M `node_modules` for host E2E pnpm) |
| `/var/www/ai.shotbro.ru` standalone.bak | **16 copies × ~48M** (~768M) |
| Playwright test-results (VPS tree) | **~92K** (E2E in container; low on host) |
| `/var/log/shotbro-e2e` | **64K** |
| journald | **319M** |
| Staging PostgreSQL (`shotbro_staging`) | **~87M** volume (`staging_pgdata`) |
| Staging MinIO volume | **~37M** (`staging_minio`) |

## TOP consumers (same filesystem)

| Rank | Path | Size | Role |
|------|------|------|------|
| 1 | `/var/lib/containerd/.../snapshots` | **63G** | Docker/BuildKit layer storage (all stacks) |
| 2 | `/var/lib/containerd/.../content/blobs` | **7G** | Image/layer blobs |
| 3 | `/usr/share/ollama/.ollama/models` | **11G** | Host LLM weights |
| 4 | `/usr/local/lib/ollama` | **4.7G** | Ollama runtime libs |
| 5 | `/var/lib/mysql` | **3.5G** | Host DB |
| 6 | `/var/www` | **4.9G** | All sites |
| 7 | Dify + parser images (unused layers) | **tens of GB** in shared 73G image total | Co-tenant stacks |

## ROOT CAUSE — why disk refills after prune

| SOURCE | TOTAL SIZE | RECLAIMABLE | RISK | ROOT CAUSE | ACTION |
|--------|------------|-------------|------|------------|--------|
| **BuildKit cache** | **42GB** | High (keep last N GB) | Low if `--keep-storage` used | Each **Next.js web build** repopulates cache; never trimmed between deploys | `staging-safe-cleanup.sh` + deploy post-build `image prune` |
| **Dangling `<none>` images** | **~7GB** (3×2.33GB) | **High** | Low | `docker build` leaves **builder stage** untagged after each web deploy | `docker image prune -f` after build (in deploy script) |
| **Old `shotbro-web-build:*` tags** | **12+ tags × 330MB** (shared layers) | Medium | Low if active/rollback kept | Every deploy tags new SHA; old tags never removed | Allowlist cleanup (`015cbb7`, `3240e70`, `ed85a6a`) |
| **`standalone.bak-*`** | **~768MB** | **High** | Low | `staging-deploy-web.sh` copies standalone every deploy | Keep **2** backups; trim in deploy + cleanup |
| **Co-tenant Docker images** | **~62GB reclaimable** total | High | **High** if removed | Dify, parser, studio stacks on same VPS | **Do not auto-delete**; coordinate with owner |
| **Ollama on host** | **~16GB** | Medium | Medium | Unrelated to Shotbro CI | Optional host cleanup outside Shotbro scope |
| **Container json logs** | **~1.1GB** | Medium | Low | Dify worker logs **382MB**; staging web minimal | json-file `max-size` (staging API/worker already 30m×4; web compose 10m×3) |
| **Host `/tmp/gpt-ci-test`** | **1.1G** | Medium | Unknown | Old CI artifact | Manual review before delete |

### Mechanism (Shotbro-specific)

1. Web deploy runs `docker build` with full monorepo context → **~2.3GB dangling builder image** per build.  
2. BuildKit cache grows with **pnpm + Next** layers (**42GB** observed).  
3. **16** standalone backup directories accumulate (**~48MB** each).  
4. **`docker system prune`** without `--keep-storage` frees space temporarily; next build refills cache → disk drops again within hours/days.

## Protected resources (never auto-delete)

- Volumes: `ai-shotbro-staging_staging_pgdata`, `staging_minio`, `staging_redis`  
- Running images: `shotbro-web-build:015cbb7`, `infra-web:deployed`, `infra-web:rollback`, `ai-shotbro-staging-api:latest`, `ai-shotbro-staging-worker:latest`  
- Rollback tags: `shotbro-web-build:3240e70`, `shotbro-web-build:ed85a6a`  
- `mcr.microsoft.com/playwright:v1.64.1-jammy` (E2E runner)  
- User MinIO objects / PostgreSQL data  

## Tools added (repo)

- `infra/scripts/staging-disk-audit.sh` — read-only report  
- `infra/scripts/staging-safe-cleanup.sh` — dry-run default, `--confirm` to apply  
- `infra/scripts/staging-disk-alert.sh` + `staging-install-disk-cron.sh`  

## AFTER safe cleanup (2026-10-25, Shotbro allowlist)

Actions: `docker image prune -f` (removed dangling Next builder layers incl. 3×2.33GB), removed **9** stale `shotbro-web-build` tags, removed `infra-web:latest`, trimmed `standalone.bak` to 2, `docker builder prune --keep-storage 12GB` (0B — cache still referenced).

| Metric | BEFORE | AFTER |
|--------|--------|-------|
| Used / free | 105G / **11G** (91%) | **98G / 18G** (85%) |
| **Reclaimed (measured)** | — | **~7GB** on `/` |
| Docker images (system df) | 73.79GB | 67.43GB |
| Build cache | 42.41GB | 42.41GB (still referenced; not safe to `-a` without image plan) |
| `shotbro-web-build` tags kept | 12+ | **015cbb7**, **3240e70**, **ed85a6a** + `infra-web:deployed`/`rollback` |
| Services | — | **web_ok**, **api_ok** (HTTPS staging) |

## Security

- No secrets printed in audit/cleanup logs.  
- No PostgreSQL/MinIO volume deletion.  
- No live AI calls.
