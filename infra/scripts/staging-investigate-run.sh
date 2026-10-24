#!/usr/bin/env bash
# Investigate failed E2E production run on staging (read-only, no secrets).
set -euo pipefail
PROJECT_ID="${1:-}"
PSQL="docker exec ai-shotbro-staging-postgres-1 psql -U shotbro_staging -d shotbro_staging -At -F $'\t'"

if [ -z "$PROJECT_ID" ]; then
  echo "=== recent E2E projects ==="
  $PSQL -c "SELECT id, title, created_at FROM project WHERE title LIKE 'E2E%' ORDER BY created_at DESC LIMIT 10;"
  exit 0
fi

echo "=== project $PROJECT_ID ==="
$PSQL -c "SELECT id, title, created_at FROM project WHERE id = '$PROJECT_ID';"

echo "=== agent runs ==="
$PSQL -c "SELECT id, status, production_state, created_at, updated_at FROM agent_run WHERE project_id = '$PROJECT_ID' ORDER BY created_at DESC LIMIT 5;"

RUN_ID=$($PSQL -c "SELECT id FROM agent_run WHERE project_id = '$PROJECT_ID' ORDER BY created_at DESC LIMIT 1;")
echo "RUN_ID=$RUN_ID"

if [ -n "$RUN_ID" ]; then
  echo "=== run metadata (redacted) ==="
  $PSQL -c "SELECT id, status, production_state, metadata::text FROM agent_run WHERE id = '$RUN_ID';"

  echo "=== approvals ==="
  $PSQL -c "SELECT id, target_type, status, target_version, decided_at FROM approval WHERE project_id = '$PROJECT_ID' ORDER BY requested_at;"

  echo "=== production graph nodes ==="
  $PSQL -c "SELECT id, node_type, status, error_code FROM production_graph_node WHERE agent_run_id = '$RUN_ID' ORDER BY created_at;"

  echo "=== assets (mp4) ==="
  $PSQL -c "SELECT id, mime_type, original_name, status, created_at FROM asset WHERE project_id = '$PROJECT_ID' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 20;"
fi
