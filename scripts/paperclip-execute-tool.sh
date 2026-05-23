#!/usr/bin/env bash
# scripts/paperclip-execute-tool.sh

# Fail fast
set -eo pipefail

# Parse args
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --tool) TOOL="$2"; shift ;;
        --parameters) PARAMS="$2"; shift ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

if [ -z "$TOOL" ] || [ -z "$PARAMS" ]; then
    echo "Usage: $0 --tool <NamespacedName> --parameters '<JsonString>'"
    exit 1
fi

# Assert Paperclip env vars are present
if [ -z "$PAPERCLIP_API_URL" ] || [ -z "$PAPERCLIP_API_KEY" ] || [ -z "$PAPERCLIP_RUN_ID" ] || [ -z "$PAPERCLIP_AGENT_ID" ] || [ -z "$PAPERCLIP_COMPANY_ID" ]; then
    echo "Error: Incomplete Paperclip environment variables."
    exit 1
fi

# Resolve projectId from execution context or fallback
PROJECT_ID="${PAPERCLIP_PROJECT_ID:-$PAPERCLIP_WORKSPACE_ID}"

# Perform call via curl through bridge proxy
curl -s -X POST "$PAPERCLIP_API_URL/api/plugins/tools/execute" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID" \
  -H "Content-Type: application/json" \
  -d $(jq -n \
    --arg tool "$TOOL" \
    --argjson params "$PARAMS" \
    --arg agentId "$PAPERCLIP_AGENT_ID" \
    --arg runId "$PAPERCLIP_RUN_ID" \
    --arg companyId "$PAPERCLIP_COMPANY_ID" \
    --arg projectId "$PROJECT_ID" \
    '{
      tool: $tool,
      parameters: $params,
      runContext: {
        agentId: $agentId,
        runId: $runId,
        companyId: $companyId,
        projectId: $projectId
      }
    }')