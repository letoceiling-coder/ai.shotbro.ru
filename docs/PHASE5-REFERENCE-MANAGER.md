# Phase 5F — Reference Manager

| Gate | Status |
|------|--------|
| IMPLEMENTED | ReferenceService + Reference Manager UI |
| PERSISTED | `projectMemory.preferences.referenceLinks` |
| WIRED | attach/detach REST, agent `attach_reference` / `detach_reference` delegates |
| VISIBLE | References tab + asset picker |
| TESTED | `phase5-references.spec.ts` |
| DEPLOYED | VPS staging |

Security: project ownership via AccessPolicyService, assets scoped to project, detach does not delete MinIO object. Roles: CHARACTER, STYLE, FIRST_FRAME, LAST_FRAME, PRODUCT, LOCATION, CAMERA, VOICE, GENERAL.

Magnific credentials: server-only staging.env — **ROTATION_REQUIRED** if previously exposed in chat; not in Git/images/logs.
