import { db } from "../lib/db.js";
import { auditLogs } from "@repo/database/schema";
import { desc, eq, and } from "drizzle-orm";
import type { AuditLog } from "@repo/database";
import type { ListAuditLogsInput } from "@repo/validators/admin";

export async function createAuditLog(data: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<AuditLog> {
  const [row] = await db.insert(auditLogs).values({
    actorId: data.actorId,
    action: data.action,
    entityType: data.entityType,
    entityId: data.entityId ?? null,
    oldValues: data.oldValues ?? null,
    newValues: data.newValues ?? null,
    ipAddress: data.ipAddress ?? null,
    userAgent: data.userAgent ?? null,
  }).returning();
  return row!;
}

export async function listAuditLogs(filter: ListAuditLogsInput): Promise<{ data: AuditLog[]; total: number }> {
  const conditions = [];
  if (filter.actorId) conditions.push(eq(auditLogs.actorId, filter.actorId));
  if (filter.entityType) conditions.push(eq(auditLogs.entityType, filter.entityType));
  if (filter.entityId) conditions.push(eq(auditLogs.entityId, filter.entityId));
  if (filter.action) conditions.push(eq(auditLogs.action, filter.action));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const [data, countRows] = await Promise.all([
    db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(pageSize).offset(offset),
    db.$count(auditLogs, where),
  ]);

  return { data, total: Number(countRows) };
}
