export type NormalizedAgentPermissions = Record<string, unknown> & {
  canCreateAgents: boolean;
  allowedPluginTools: Record<string, boolean>;
};

export function defaultPermissionsForRole(role: string): NormalizedAgentPermissions {
  return {
    canCreateAgents: role === "ceo",
    allowedPluginTools: {},
  };
}

export function normalizeAgentPermissions(
  permissions: unknown,
  role: string,
): NormalizedAgentPermissions {
  const defaults = defaultPermissionsForRole(role);
  if (typeof permissions !== "object" || permissions === null || Array.isArray(permissions)) {
    return defaults;
  }

  const record = permissions as Record<string, unknown>;
  
  const allowedPluginTools: Record<string, boolean> = {};
  if (
    record.allowedPluginTools &&
    typeof record.allowedPluginTools === "object" &&
    !Array.isArray(record.allowedPluginTools)
  ) {
    for (const [key, value] of Object.entries(record.allowedPluginTools)) {
      if (typeof value === "boolean") {
        allowedPluginTools[key] = value;
      }
    }
  }

  return {
    canCreateAgents:
      typeof record.canCreateAgents === "boolean"
        ? record.canCreateAgents
        : defaults.canCreateAgents,
    allowedPluginTools,
  };
}
