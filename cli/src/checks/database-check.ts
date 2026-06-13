import fs from "node:fs";
import type { PaperclipConfig } from "../config/schema.js";
import type { CheckResult } from "./index.js";
import { resolveRuntimeLikePath } from "./path-resolver.js";

export async function databaseCheck(config: PaperclipConfig, configPath?: string): Promise<CheckResult> {
  const envUrl = process.env.DATABASE_URL?.trim();
  const effectiveUrl = envUrl || config.database.connectionString?.trim();

  if (effectiveUrl) {
    try {
      const { createDb } = await import("@paperclipai/db");
      const db = createDb(effectiveUrl);
      await db.execute("SELECT 1");
      const source = envUrl ? "DATABASE_URL env var" : "config.database.connectionString";
      return {
        name: "Database",
        status: "pass",
        message: `PostgreSQL connection successful (using ${source})`,
      };
    } catch (err) {
      return {
        name: "Database",
        status: "fail",
        message: `Cannot connect to PostgreSQL: ${err instanceof Error ? err.message : String(err)}`,
        canRepair: false,
        repairHint: "Check your connection string and ensure PostgreSQL is running",
      };
    }
  } else {
    return {
      name: "Database",
      status: "fail",
      message: "PostgreSQL mode selected but no connection string configured",
      canRepair: false,
      repairHint: "Run `paperclipai configure --section database`",
    };
  }

  if (config.database.mode === "embedded-postgres") {
    const dataDir = resolveRuntimeLikePath(config.database.embeddedPostgresDataDir, configPath);
    const reportedPath = dataDir;
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(reportedPath, { recursive: true });
    }

    return {
      name: "Database",
      status: "pass",
      message: `Embedded PostgreSQL configured at ${dataDir} (port ${config.database.embeddedPostgresPort})`,
    };
  }

  return {
    name: "Database",
    status: "fail",
    message: `Unknown database mode: ${String(config.database.mode)}`,
    canRepair: false,
    repairHint: "Run `paperclipai configure --section database`",
  };
}
