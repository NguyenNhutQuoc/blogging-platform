import * as auditRepo from "../repositories/audit.js";

/**
 * Fire-and-forget audit log helper. Never throws — a failed audit log
 * should never break the primary operation.
 */
export function logAudit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  values: { old?: Record<string, unknown>; new?: Record<string, unknown> } = {},
  context: { ip?: string; ua?: string } = {}
): void {
  auditRepo.createAuditLog({
    actorId,
    action,
    entityType,
    entityId,
    oldValues: values.old ?? null,
    newValues: values.new ?? null,
    ipAddress: context.ip ?? null,
    userAgent: context.ua ?? null,
  }).catch((err) => {
    console.error("[audit] Failed to write audit log:", err);
  });
}
