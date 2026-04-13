import { uuidv7 } from "uuidv7";

/**
 * Generates a UUID v7 (time-ordered, lexicographically sortable).
 * All primary keys in the database use this format for:
 * - Natural ordering by creation time without extra indexes
 * - Globally unique across distributed writes
 */
export function generateId(): string {
  return uuidv7();
}
