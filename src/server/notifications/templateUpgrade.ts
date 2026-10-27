import "server-only";
import { and, eq } from "drizzle-orm";
import { SEED_TEMPLATES } from "@/lib/admin/templates";
import type { Executor } from "@/server/db/client";
import { notificationTemplates } from "@/server/db/schema";
import { logger } from "@/server/logging/logger";

/**
 * Brings a database seeded by an earlier version up to the current seeded
 * templates, at start-up. Never touches a template an administrator has
 * saved (it has updated_by set):
 *
 * - a seeded template still as seeded, whose seed has a newer version, gets
 *   the new wording (the reset email now carries its link);
 * - a seeded template that doesn't exist yet is added, active only if no
 *   other template is active for its event and channel.
 *
 * A no-op once done.
 */
export async function upgradeSeededTemplates(db: Executor) {
  const existing = await db.select().from(notificationTemplates);
  const byCode = new Map(existing.map((t) => [t.code, t]));
  let updated = 0;
  let added = 0;
  for (const seed of SEED_TEMPLATES) {
    const current = byCode.get(seed.code);
    if (current) {
      if (current.updatedBy === null && current.version < seed.version) {
        await db
          .update(notificationTemplates)
          .set({ subject: seed.subject, body: seed.body, version: seed.version })
          .where(and(eq(notificationTemplates.id, current.id), eq(notificationTemplates.version, current.version)));
        updated++;
      }
      continue;
    }
    const taken = existing.some((t) => t.event === seed.event && t.channel === seed.channel && t.language === seed.language && t.status === "ACTIVE");
    await db
      .insert(notificationTemplates)
      .values({ id: seed.id, code: seed.code, name: seed.name, channel: seed.channel, event: seed.event, language: seed.language, subject: seed.subject, body: seed.body, status: taken ? "INACTIVE" : seed.status, version: seed.version, notes: seed.notes })
      .onConflictDoNothing();
    added++;
  }
  if (updated || added) logger.info("Notification templates brought up to date", { updated, added });
}
