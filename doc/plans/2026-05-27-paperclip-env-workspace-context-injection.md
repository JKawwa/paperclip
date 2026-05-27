# Robust Project and Workspace ID Environment Injection for Adapter Execution

Date: 2026-05-27

## Context

When running plugin tools statelessly via `/api/plugins/tools/execute`, the tool host must authorize the request against a specific company tenant, project, and workspace. This requires the agent's runtime environment to have `PAPERCLIP_PROJECT_ID` and `PAPERCLIP_WORKSPACE_ID` correctly populated.

If these environment variables are missing, any calls to plugin tools will fail with `400/403` HTTP errors because the tool execution service cannot verify the tenant or workspace boundaries.

---

## The Core Design Issue

Historically, the environment builder `buildPaperclipEnv` only accepted the `AdapterAgent` object:

```typescript
export function buildPaperclipEnv(agent: AdapterAgent): Record<string, string>;
```

It attempted to extract `projectId` and `workspaceId` directly from the `agent` object. However, under Core Engineering Rule 1, every domain entity is scoped to a **company**, and agents are *not* tied to a single project or workspace. They can execute work across different projects and workspaces within their company. Therefore, `agent.projectId` and `agent.workspaceId` are empty in practice.

The execution's workspace scope is dynamic and is instead supplied during runtime inside the execution `context` parameter.

---

## Divergent / Fragile Attempts

Earlier attempts to fix this issue introduced fragile constructs:

1. **Rigid Three-Argument Signature:**
   `buildPaperclipEnv(agent, context, { projectId: context.projectId, workspaceId: context.workspaceId })`
   This forced all calling adapters to reconstruct a separate configuration object, duplicating parameters and leading to cluttered invocation sites.

2. **Schema and Type Pollution:**
   Adding required `projectId` and `workspaceId` properties to the `AdapterAgent` type contract. This polluted the data interface and forced developers to supply mock IDs in unit tests where workspace context was irrelevant.

3. **Incorrect Heartbeat Extrapolations:**
   Forcing `run.projectId` into the heartbeat run context inside `server/src/services/heartbeat.ts`:
   ```typescript
   context: { ...context, projectId: run.projectId }
   ```
   This caused runtime errors/warnings because `heartbeat_runs` does not have a `projectId` column in the database.

---

## The Final Clean Solution

To address this cleanly and preserve system invariants, the following design was implemented:

### 1. Robust Signature & Fallback Resolution
The `buildPaperclipEnv` signature was updated to accept the dynamic execution `context` directly as an optional second parameter:

```typescript
export function buildPaperclipEnv(
  agent: {
    id: string;
    companyId: string;
    projectId?: string | null;
    workspaceId?: string | null;
  },
  context?: Record<string, unknown>,
): Record<string, string>;
```

Inside the function, we extract the IDs using robust, layered fallbacks to support all execution formats:

* **Project ID Resolution:**
  1. `context.paperclipWorkspace.projectId` (standard structured workspace context)
  2. `context.projectId` (flat task/run execution property)
  3. `agent.projectId` (fallback if present on agent object)

* **Workspace ID Resolution:**
  1. `context.paperclipWorkspace.workspaceId`
  2. `context.workspaceId`
  3. `context.executionWorkspaceId` (fallback key from some custom integrations)
  4. `agent.workspaceId`

### 2. Clean Adapter Invocations
All adapters (local, cloud, and process execution) were updated to pass their execution context cleanly:

```typescript
const env = { ...buildPaperclipEnv(agent, context) };
```

This keeps the calling code simple and keeps the signature clean.

---

## Verification

The correctness of this fallback behavior is verified in `server/src/__tests__/paperclip-env.test.ts`.

To verify compilation and typecheck across the whole workspace (25 packages):

```bash
npx pnpm -r typecheck
```
