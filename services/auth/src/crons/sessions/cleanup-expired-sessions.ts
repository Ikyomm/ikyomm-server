import { getDB, session } from "@ikyomm/database";
import { sql } from "drizzle-orm";
import type { CronJobDefinition } from "../types";

const EXPIRED_SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const EXPIRED_SESSION_CLEANUP_BATCH_SIZE = 1000;
const EXPIRED_SESSION_CLEANUP_MAX_BATCHES = 50;
const EXPIRED_SESSION_CLEANUP_LOCK_KEY = "auth:expired-session-cleanup";

type CleanupBatchRow = {
  deletedCount: number;
};

type AdvisoryLockRow = {
  acquired: boolean;
};

export async function cleanupExpiredSessions() {
  const db = getDB();
  const cutoff = new Date();
  let deletedCount = 0;
  let batches = 0;
  let lockAcquired = false;

  await db.transaction(async (tx) => {
    const lockResult = await tx.execute<AdvisoryLockRow>(sql`
      select pg_try_advisory_xact_lock(hashtext(${EXPIRED_SESSION_CLEANUP_LOCK_KEY})::bigint) as acquired
    `);

    lockAcquired = Boolean(lockResult.rows[0]?.acquired);
    if (!lockAcquired) {
      return;
    }

    while (batches < EXPIRED_SESSION_CLEANUP_MAX_BATCHES) {
      const result = await tx.execute<CleanupBatchRow>(sql`
        with expired_sessions as (
          select ${session.id}
          from ${session}
          where ${session.expiresAt} < ${cutoff}
          order by ${session.expiresAt} asc
          limit ${EXPIRED_SESSION_CLEANUP_BATCH_SIZE}
        ),
        deleted_sessions as (
          delete from ${session}
          using expired_sessions
          where ${session.id} = expired_sessions.id
          returning ${session.id}
        )
        select count(*)::int as "deletedCount"
        from deleted_sessions
      `);

      const batchDeletedCount = result.rows[0]?.deletedCount ?? 0;
      deletedCount += batchDeletedCount;
      batches += 1;

      if (batchDeletedCount < EXPIRED_SESSION_CLEANUP_BATCH_SIZE) {
        break;
      }
    }
  });

  return {
    cutoff: cutoff.toISOString(),
    deletedCount,
    batches,
    lockAcquired,
    reachedBatchLimit:
      lockAcquired && batches === EXPIRED_SESSION_CLEANUP_MAX_BATCHES && deletedCount > 0,
  };
}

export const cleanupExpiredSessionsCron: CronJobDefinition = {
  name: "auth.sessions.cleanup-expired",
  intervalMs: EXPIRED_SESSION_CLEANUP_INTERVAL_MS,
  runOnStart: true,
  run: cleanupExpiredSessions,
};
