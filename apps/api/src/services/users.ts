import { AppError } from "../lib/errors.js";
import { logAudit } from "../lib/audit.js";
import * as repo from "../repositories/users.js";
import type { User } from "@repo/database";
import type { ListUsersInput, ChangeRoleInput, ChangeStatusInput } from "@repo/validators/admin";
import type { UserRole, UserStatus } from "@repo/shared";

export async function listUsers(filter: ListUsersInput): Promise<{ data: User[]; total: number }> {
  return repo.listUsers(filter);
}

export async function getUser(id: string): Promise<User> {
  const user = await repo.findUserById(id);
  if (!user) throw AppError.notFound("User not found");
  return user;
}

export async function changeRole(
  actorId: string,
  targetId: string,
  input: ChangeRoleInput,
  context: { ip?: string; ua?: string } = {}
): Promise<User> {
  const target = await repo.findUserById(targetId);
  if (!target) throw AppError.notFound("User not found");

  const oldRole = target.role;
  const updated = await repo.updateUserRole(targetId, input.role as UserRole);
  if (!updated) throw AppError.notFound("User not found");

  logAudit(actorId, "user.role_changed", "user", targetId, { old: { role: oldRole }, new: { role: input.role } }, context);
  return updated;
}

export async function changeStatus(
  actorId: string,
  targetId: string,
  input: ChangeStatusInput,
  context: { ip?: string; ua?: string } = {}
): Promise<User> {
  const target = await repo.findUserById(targetId);
  if (!target) throw AppError.notFound("User not found");

  const oldStatus = target.status;
  const updated = await repo.updateUserStatus(targetId, input.status as UserStatus);
  if (!updated) throw AppError.notFound("User not found");

  const action = input.status === "banned" ? "user.banned" : input.status === "suspended" ? "user.suspended" : "user.restored";
  logAudit(actorId, action, "user", targetId, { old: { status: oldStatus }, new: { status: input.status } }, context);
  return updated;
}
