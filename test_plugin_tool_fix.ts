#!/usr/bin/env tsx

import { buildPaperclipEnv } from "@paperclipai/adapter-utils/server-utils";

/**
 * Test script to verify that the fix for PAPERCLIP_PROJECT_ID and PAPERCLIP_WORKSPACE_ID
 * environment variables works correctly.
 */
function testBuildPaperclipEnv() {
  console.log("Testing buildPaperclipEnv function...");

  // Test case 1: Agent with projectId/workspaceId but no runContext
  const agent1 = {
    id: "agent_1",
    companyId: "company_1",
    projectId: "agent_project_1",
    workspaceId: "agent_workspace_1",
  };

  const env1 = buildPaperclipEnv(agent1);
  console.log("Test 1 - Agent with projectId/workspaceId, no runContext:");
  console.log(`  PAPERCLIP_PROJECT_ID: ${env1.PAPERCLIP_PROJECT_ID}`);
  console.log(`  PAPERCLIP_WORKSPACE_ID: ${env1.PAPERCLIP_WORKSPACE_ID}`);
  console.log(`  Expected: agent_project_1 / agent_workspace_1`);
  console.log(`  Result: ${env1.PAPERCLIP_PROJECT_ID === "agent_project_1" && env1.PAPERCLIP_WORKSPACE_ID === "agent_workspace_1" ? "PASS" : "FAIL"}`);
  console.log();

  // Test case 2: Agent without projectId/workspaceId but with runContext
  const agent2 = {
    id: "agent_2",
    companyId: "company_2",
  };

  const runContext2 = {
    projectId: "run_context_project_2",
    workspaceId: "run_context_workspace_2",
  };

  const env2 = buildPaperclipEnv(agent2, runContext2);
  console.log("Test 2 - Agent without projectId/workspaceId, with runContext:");
  console.log(`  PAPERCLIP_PROJECT_ID: ${env2.PAPERCLIP_PROJECT_ID}`);
  console.log(`  PAPERCLIP_WORKSPACE_ID: ${env2.PAPERCLIP_WORKSPACE_ID}`);
  console.log(`  Expected: run_context_project_2 / run_context_workspace_2`);
  console.log(`  Result: ${env2.PAPERCLIP_PROJECT_ID === "run_context_project_2" && env2.PAPERCLIP_WORKSPACE_ID === "run_context_workspace_2" ? "PASS" : "FAIL"}`);
  console.log();

  // Test case 3: Agent with projectId/workspaceId and runContext (runContext should take precedence)
  const agent3 = {
    id: "agent_3",
    companyId: "company_3",
    projectId: "agent_project_3",
    workspaceId: "agent_workspace_3",
  };

  const runContext3 = {
    projectId: "run_context_project_3",
    workspaceId: "run_context_workspace_3",
  };

  const env3 = buildPaperclipEnv(agent3, runContext3);
  console.log("Test 3 - Agent with projectId/workspaceId, with runContext (runContext should take precedence):");
  console.log(`  PAPERCLIP_PROJECT_ID: ${env3.PAPERCLIP_PROJECT_ID}`);
  console.log(`  PAPERCLIP_WORKSPACE_ID: ${env3.PAPERCLIP_WORKSPACE_ID}`);
  console.log(`  Expected: run_context_project_3 / run_context_workspace_3`);
  console.log(`  Result: ${env3.PAPERCLIP_PROJECT_ID === "run_context_project_3" && env3.PAPERCLIP_WORKSPACE_ID === "run_context_workspace_3" ? "PASS" : "FAIL"}`);
  console.log();

  // Test case 4: Agent without projectId/workspaceId and without runContext (should not set the variables)
  const agent4 = {
    id: "agent_4",
    companyId: "company_4",
  };

  const env4 = buildPaperclipEnv(agent4);
  console.log("Test 4 - Agent without projectId/workspaceId, without runContext:");
  console.log(`  PAPERCLIP_PROJECT_ID: ${env4.PAPERCLIP_PROJECT_ID || "undefined"}`);
  console.log(`  PAPERCLIP_WORKSPACE_ID: ${env4.PAPERCLIP_WORKSPACE_ID || "undefined"}`);
  console.log(`  Expected: undefined / undefined`);
  console.log(`  Result: ${!env4.PAPERCLIP_PROJECT_ID && !env4.PAPERCLIP_WORKSPACE_ID ? "PASS" : "FAIL"}`);
  console.log();

  console.log("Test completed.");
}

testBuildPaperclipEnv();