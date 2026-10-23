# Phase 3 — Git notes

## `phase2-rc1` vs RC HEAD

| Ref | Commit | Message |
|-----|--------|---------|
| `phase2-rc1` (peeled) | `e5c4045967e8a3b0b6f6d69ef0a452bb1b144d54` | `phase2: finalize release candidate` |
| `phase2/backend` @ Phase 3 start | same | same |

The tag **matches** the documented RC commit. An earlier session briefly reported `06c42be` when the tag had not yet been updated locally.

**Policy:** Do not move or force-update `phase2-rc1` without owner approval.

## Phase 3 commits

| Commit | Description |
|--------|-------------|
| `0288d45` | Foundation: env guards, contracts, migration 0001, linear mock agent API |
| (pending) | Orchestrator, approvals gate, graph, finance schema 0002, worker queue |
