---
name: paperclip-plugin-tools
description: >
  Discover and execute plugin-contributed integration tools (e.g. Slack, Linear,
  custom webhooks). Use when you need to call a third-party integration tool that
  has been installed as a Paperclip plugin and granted to you via your permissions.
  Do NOT use for standard Paperclip coordination — use the paperclip skill for that.
---

# Plugin Tools Skill

Paperclip plugins can contribute **integration tools** — callable actions backed by
a running plugin worker (e.g. post a Slack message, create a Linear issue, trigger a
webhook). You can only execute tools that have been explicitly granted to you in your
agent permissions.

## Discovering Available Tools

List all tools currently registered by ready plugins:

```
GET /api/plugins/tools
Authorization: Bearer $PAPERCLIP_API_KEY
```

Filter to a specific plugin:

```
GET /api/plugins/tools?pluginId=<pluginId>
Authorization: Bearer $PAPERCLIP_API_KEY
```

Each tool descriptor in the response has:

| Field | Description |
|---|---|
| `name` | Fully namespaced tool name, e.g. `paperclip-plugin-slack:post_custom_message` |
| `displayName` | Human-readable name |
| `description` | What the tool does and when to use it |
| `parametersSchema` | JSON Schema describing the required input |
| `pluginId` | The plugin that provides this tool |

## Checking Your Permissions

Your granted tools are listed in `allowedPluginTools` on your agent record:

```
GET /api/agents/me
Authorization: Bearer $PAPERCLIP_API_KEY
```

Look at `permissions.allowedPluginTools` — it is a map of `{ "<tool-name>": true }`.
Only tools with `true` can be executed by you. Attempting to execute a tool not in
this map will return `403 Access Denied`.

## Executing a Tool

```
POST /api/plugins/tools/execute
Authorization: Bearer $PAPERCLIP_API_KEY
X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID
Content-Type: application/json

{
  "tool": "<namespaced-tool-name>",
  "parameters": { ... },
  "runContext": {
    "agentId": "$PAPERCLIP_AGENT_ID",
    "runId": "$PAPERCLIP_RUN_ID",
    "companyId": "$PAPERCLIP_COMPANY_ID",
    "projectId": "$PAPERCLIP_PROJECT_ID"
  }
}
```

`$PAPERCLIP_PROJECT_ID` falls back to `$PAPERCLIP_WORKSPACE_ID` if not set.

### Example — curl

```bash
curl -s -X POST "$PAPERCLIP_API_URL/api/plugins/tools/execute" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg tool "paperclip-plugin-slack:post_custom_message" \
    --arg agentId "$PAPERCLIP_AGENT_ID" \
    --arg runId "$PAPERCLIP_RUN_ID" \
    --arg companyId "$PAPERCLIP_COMPANY_ID" \
    --arg projectId "${PAPERCLIP_PROJECT_ID:-$PAPERCLIP_WORKSPACE_ID}" \
    '{
      tool: $tool,
      parameters: { channelId: "C07JZQZQZ7T", text: "Hello from agent" },
      runContext: { agentId: $agentId, runId: $runId, companyId: $companyId, projectId: $projectId }
    }')"
```

### Example — PowerShell

```powershell
$body = @{
  tool = "paperclip-plugin-slack:post_custom_message"
  parameters = @{ channelId = "C07JZQZQZ7T"; text = "Hello from agent" }
  runContext = @{
    agentId   = $env:PAPERCLIP_AGENT_ID
    runId     = $env:PAPERCLIP_RUN_ID
    companyId = $env:PAPERCLIP_COMPANY_ID
    projectId = if ($env:PAPERCLIP_PROJECT_ID) { $env:PAPERCLIP_PROJECT_ID } else { $env:PAPERCLIP_WORKSPACE_ID }
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Uri "$($env:PAPERCLIP_API_URL)/api/plugins/tools/execute" `
  -Method POST `
  -Headers @{
    "Authorization"       = "Bearer $($env:PAPERCLIP_API_KEY)"
    "X-Paperclip-Run-Id"  = $env:PAPERCLIP_RUN_ID
    "Content-Type"        = "application/json"
  } `
  -Body $body
```

## Response

On success the response body is a `ToolExecutionResult`:

```json
{
  "pluginId": "<plugin-db-id>",
  "result": {
    "content": "...",
    "error": null
  }
}
```

## Error Codes

| Status | Meaning |
|---|---|
| `400` | Missing or invalid request fields |
| `403` | Tool not granted to your agent, or run context mismatch |
| `404` | Tool name not found in the registry |
| `501` | Plugin tool dispatch not enabled on this server |
| `502` | Plugin worker is not running or crashed |

## Critical Rules

- Always include `X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID` — this links tool calls to your run for audit.
- Check `GET /api/plugins/tools` first to confirm the tool name and parameter schema before calling execute.
- Do not hard-code tool names — discover them at runtime so your heartbeat works even if plugins change.
- A `403` means the board has not granted you that tool. Do not retry — escalate via your chain of command.
