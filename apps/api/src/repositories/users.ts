import { db } from "../lib/db.js";
import { users } from "@repo/database/schema";
import { eq, and, ilike, or, sql } from "drizzle-orm";
import type { User } from "@repo/database";
import type { ListUsersInput } from "@repo/validators/admin";
import type { UserRole, UserStatus } from "@repo/shared";

export async function findUserById(id: string): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(and(eq(users.id, id), sql`${users.deletedAt} IS NULL`));
  return row;
}

export async function listUsers(filter: ListUsersInput): Promise<{ data: User[]; total: number }> {
  const conditions = [sql`${users.deletedAt} IS NULL`];

  if (filter.role) conditions.push(eq(users.role, filter.role));
  if (filter.status) conditions.push(eq(users.status, filter.status));
  if (filter.search) {
    conditions.push(or(
      ilike(users.name, `%${filter.search}%`),
      ilike(users.email, `%${filter.search}%`)
    )!);
  }

  const where = and(...conditions);
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const [data, countRows] = await Promise.all([
    db.select().from(users).where(where).orderBy(users.createdAt).limit(pageSize).offset(offset),
    db.$count(users, where),
  ]);

  return { data, total: Number(countRows) };
}

export async function updateUserRole(id: string, role: UserRole): Promise<User | undefined> {
  const [row] = await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, id)).returning();
  return row;
}

export async function updateUserStatus(id: string, status: UserStatus): Promise<User | undefined> {
  const [row] = await db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, id)).returning();
  return row;
}

export async function softDeleteUser(id: string): Promise<User | undefined> {
  const anonymizedEmail = `deleted-${id}@deleted.invalid`;
  const [row] = await db.update(users)
    .set({ deletedAt: new Date(), email: anonymizedEmail, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return row;
}
