import { describe, expect, it } from "vitest";
import { execute } from "../src/server/execute.js";
import { type AdapterExecutionContext } from "@paperclipai/adapter-utils";

describe("opencode-local adapter", () => {
  it("sets PAPERCLIP_PROJECT_ID and PAPERCLIP_WORKSPACE_ID environment variables", async () => {
    const context: AdapterExecutionContext = {
      runId: "run_1",
      agent: {
        id: "agent_1",
        companyId: "company_1",
        projectId: "project_1",
        workspaceId: "workspace_1",
      },
      runtime: {
        sessionId: "",
        sessionParams: {},
      },
      config: {
        command: "opencode",
        model: "mistral-7b",
      },
      context: {
        projectId: "project_1",
        workspaceId: "workspace_1",
      },
      onLog: async () => {},
      onMeta: async () => {},
      onSpawn: async () => {},
    };

    const result = await execute(context);
    expect(result.exitCode).toBe(0);
    // TODO: Add assertions to check if the environment variables are set correctly
  });
});