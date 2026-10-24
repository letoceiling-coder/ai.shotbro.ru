# Phase 5 — Model Settings Engine

## Components

| Module | Role | Status |
|--------|------|--------|
| `MODEL_PARAMETER_REGISTRY` | Per-model parameter schemas + presets | IMPLEMENTED |
| `ModelParameterValidator` | Defaults, bounds, unsupported param rejection | IMPLEMENTED |
| `SceneModelSettingsSchema` | Scene-scoped persisted settings | WIRED (project memory) |
| API `GET/PATCH …/scenes/:id/model-settings` | Server persistence | WIRED |
| API `GET /providers/model-parameters` | UI + agent consumption | WIRED |
| `ModelSettingsSection` UI | Dynamic controls from schema | VISIBLE (Creative → Models) |

Settings stored under `project_memory.preferences.sceneModelSettings[sceneId]` with monotonic `version`.

Agent tools (`list_available_models`, `get_model_parameters`, …) — **NOT IMPLEMENTED** (Phase 5K extension).

Presets: DEFAULT/QUALITY/ECONOMY via mock image; Magnific creative profiles (Portrait Preservation, etc.) in registry — not quality guarantees.
