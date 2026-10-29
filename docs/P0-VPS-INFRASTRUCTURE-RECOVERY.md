# P0 — VPS infrastructure recovery (85.117.235.93)

**Context:** Phase **5L-B** blocked — staging unreachable.  
**Git acceptance target:** `fffce7d` (runner) · code **`c089f793`** · API/Worker last known **`20539645`**.  
**Updated:** 2026-10-29

---

## 1. External diagnostics (agent / developer workstation)

| Layer | Check | Result (2026-10-29) | Interpretation |
|-------|--------|------------------------|----------------|
| DNS | `ai.shotbro.ru` → A record | **85.117.235.93** | DNS OK |
| TCP :443 (local curl) | `curl -m 12 https://ai.shotbro.ru/.../health/live` | **timeout**, HTTP=000 | No TCP completion from this path **or** SYN blackholed |
| HTTPS (edge fetch) | same URL | **504 Gateway Timeout** | Resolver + edge exist; **origin/backend not responding in time** |
| SSH :22 | `ssh -o BatchMode -o ConnectTimeout=25 root@85.117.235.93` | **timeout** | Shell/admin path down (host firewalled, sshd hung, or host/network down) |

**Conclusion:** Not a Git or test defect. **Host or network path to 85.117.235.93 is impaired.** SSH and direct HTTPS fail together → prioritize **provider console / out-of-band** access.

**Do not assume:** “server powered off” from SSH alone — **504** implies something still answers at the edge (CDN/proxy) while origin is dead/saturated.

---

## 2. Likely RCA hypotheses (verify on console)

Ordered by prior evidence on this host (`VPS-DISK-FORENSICS.md`, interrupted **`c089f793` web Docker build**):

| # | Hypothesis | Evidence to collect |
|---|------------|---------------------|
| H1 | **Docker build OOM / CPU stall** during `shotbro/web:build` | `dmesg \| grep -i oom`; `journalctl -k`; build still running? |
| H2 | **Disk / inode full** on `/dev/vda1` (historically **~91%**) | `df -h`, `df -i`; buildkit/containerd growth |
| H3 | **dockerd / containerd hung** | `systemctl status docker`; `docker ps` hangs |
| H4 | **Caddy/nginx down** (443 open but app unhealthy) | `docker ps`, Caddy container logs, `curl -s localhost:3020` on host |
| H5 | **Provider network / hypervisor** | Provider panel: VM running? VNC? ping from console |

**Forbidden without RCA:** blind `reboot`, `iptables -F`, `docker system prune -a`, volume removal, Postgres/MinIO data delete.

---

## 3. Provider console — safe recovery sequence

Run as **root** on the VM (VNC/serial if SSH dead):

```bash
# A. Snapshot evidence first
date -Is; uptime; free -h; df -h; df -i
dmesg -T | tail -80
journalctl -p err -b --no-pager | tail -50
systemctl is-active docker ssh caddy 2>/dev/null || true

# B. Docker (read-only)
docker ps -a --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null | head -30
docker inspect infra-web-1 ai-shotbro-staging-api-1 ai-shotbro-staging-worker-1 \
  --format '{{.Name}} {{index .Config.Labels "org.shotbro.build-sha"}}' 2>/dev/null

# C. Stuck builds / E2E (do not start new acceptance if these run)
pgrep -af 'docker build|playwright test|phase5l-b-acceptance' || true

# D. Local health (on host)
curl -sS -m 5 http://127.0.0.1:3020/api/v1/health/live || true
curl -sS -m 5 http://127.0.0.1:3021/api/v1/health/live || true
```

**Minimal remediation (only if evidence supports):**

1. **Disk ≥95%:** `bash /var/www/ai.shotbro.ru-src/infra/scripts/staging-safe-cleanup.sh --confirm` (Shotbro allowlist only).
2. **Stuck `docker build`:** stop that build PID/container; do **not** prune volumes.
3. **Docker inactive:** `systemctl start docker` (once), verify `docker ps`.
4. **Web/API containers exited:** `cd /var/www/ai.shotbro.ru-src/infra && docker compose -p ai-shotbro-staging ps` — restart **only** staging stack per runbook, not `down -v`.

**Rollback:** `shotbro/web:rollback`, `shotbro/api:rollback` labels (see `staging-deploy.sh`).

---

## 4. After SSH + health OK — Shotbro 5L-B acceptance

```bash
cd /var/www/ai.shotbro.ru-src
git fetch origin fffce7d947297e1ea685c30eb410d7738747daf5
git reset --hard fffce7d947297e1ea685c30eb410d7738747daf5
chmod +x infra/scripts/*.sh

# Web must include c089f793 (sidebar testid + rehydrate)
docker inspect infra-web-1 --format '{{index .Config.Labels "org.shotbro.build-sha"}}'
# if not c089f793* :
bash infra/scripts/staging-deploy.sh --service web c089f79

curl -sS https://ai.shotbro.ru/api/v1/health/live
curl -sS https://ai.shotbro.ru/api/v1/health/ready

# Single sequential acceptance (flock + EXIT_CODE in log)
bash infra/scripts/phase5l-b-acceptance-run.sh
tail -5 /var/log/shotbro-e2e/phase5l-b-acceptance-*.log
```

**PASS criteria:** `PHASE5L_B_ALL_PASS`, log line `EXIT_CODE=0`, agent-integration **2/2**, regression **8/8**, unified-studio **PASS**, idempotency + media guard PASS. Mock media only.

---

## 5. Agent limitation (no console access)

If **SSH and provider console are unavailable to the agent**, recovery **cannot** be completed from CI/agent. This document + `PHASE5L-5B-STATUS.md` record diagnostics; **human operator** must execute §3–4 and paste logs for sign-off.

---

## 6. Post-recovery documentation

Update `PHASE5L-5B-STATUS.md` → **ACCEPTED** only after §4 green. Update `PHASE5-PROGRESS.md` runtime SHAs. **Do not start 5L-C** until then.
