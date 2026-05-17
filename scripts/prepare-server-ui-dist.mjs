#!/usr/bin/env node
// prepare-server-ui-dist.mjs — Build the UI and copy it into server/ui-dist.
// This keeps @paperclipai/server publish artifacts self-contained for static UI serving.
// When PAPERCLIP_RELEASE_REUSE_UI_DIST=1 and ui/dist already exists, reuse that
// output instead of rebuilding it again inside the release packaging flow.

import { existsSync, rmSync, cpSync } from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const UI_DIST = path.join(REPO_ROOT, "ui", "dist");
const SERVER_UI_DIST = path.join(REPO_ROOT, "server", "ui-dist");

const rawFlag = process.env.PAPERCLIP_RELEASE_REUSE_UI_DIST ?? "";
const shouldReuseExistingUiDist = ["1", "true", "TRUE", "yes", "YES"].includes(rawFlag);

if (shouldReuseExistingUiDist && existsSync(path.join(UI_DIST, "index.html"))) {
  console.log("  -> Reusing existing @paperclipai/ui dist output");
} else {
  console.log("  -> Building @paperclipai/ui...");
  execSync("pnpm --filter @paperclipai/ui build", {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
}

if (!existsSync(path.join(UI_DIST, "index.html"))) {
  console.error("Error: UI build output missing at", path.join(UI_DIST, "index.html"));
  process.exit(1);
}

rmSync(SERVER_UI_DIST, { recursive: true, force: true });
cpSync(UI_DIST, SERVER_UI_DIST, { recursive: true });
console.log("  -> Copied ui/dist to server/ui-dist");
