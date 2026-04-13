import { testDb } from "./setup.js";
import { users } from "@repo/database/schema";
import { uuidv7 } from "uuidv7";
import type { UserRole } from "@repo/shared";

/**
 * Test data factories — provide typed, minimal valid objects so tests
 * don't need to repeat boilerplate.
 */

export async function createTestUser(overrides: {
  role?: UserRole;
  email?: string;
  name?: string;
} = {}) {
  const id = uuidv7();
  const [user] = await testDb
    .insert(users)
    .values({
      id,
      email: overrides.email ?? `test-${id}@example.com`,
      name: overrides.name ?? "Test User",
      role: overrides.role ?? "author",
      status: "active",
      emailVerifiedAt: new Date(),
    })
    .returning();
  return user!;
}
