import { auth } from "../lib/auth.js";
import { db } from "../lib/db.js";
import { users } from "@repo/database/schema";
import { eq } from "drizzle-orm";

async function createAdmin() {
  const email = "admin@example.com";
  const password = "AdminPassword123!";
  const name = "Admin User";

  console.log(`Creating user: ${email}...`);

  try {
    // Delete existing user if any, to avoid conflicts
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing) {
      console.log(`User ${email} already exists. Deleting first to reset...`);
      await db.delete(users).where(eq(users.email, email));
    }

    // Sign up the user programmatically
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
      },
    });

    if (!result) {
      throw new Error("Sign up failed, no result returned.");
    }

    console.log(`User created. Elevating role to 'admin' and setting status to 'active'...`);

    // Set role to admin and status to active
    await db
      .update(users)
      .set({
        role: "admin",
        status: "active",
        emailVerifiedAt: new Date(),
      })
      .where(eq(users.email, email));

    console.log("✅ Admin user created successfully!");
    console.log("----------------------------------------");
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log("----------------------------------------");
  } catch (error) {
    console.error("❌ Failed to create admin user:", error);
  } finally {
    process.exit(0);
  }
}

createAdmin();
