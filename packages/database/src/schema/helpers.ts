import { uuidv7 } from "uuidv7";
import { timestamp, text } from "drizzle-orm/pg-core";

/**
 * UUID v7 primary key — time-ordered so rows sort naturally by creation time.
 * This avoids the need for a separate created_at index in most queries.
 */
export const primaryId = () =>
  text("id")
    .$defaultFn(() => uuidv7())
    .primaryKey();

/**
 * Standard audit timestamps — managed automatically on insert/update.
 * updatedAt uses $onUpdateFn so it refreshes on every Drizzle update call.
 */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
};

/**
 * Soft delete column — rows with a non-null deletedAt are excluded from
 * normal queries but retained for audit/recovery purposes.
 */
export const softDelete = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};
