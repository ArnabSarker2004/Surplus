import type pg from 'pg';
import type { WorkspaceRepository } from '../repositories/workspace-repository';
import { PostgresWorkspace } from '../repositories/postgres-workspace';
import { PlaidService } from './plaid-service';
import { forecast } from './intelligence-service';
import { recordForecast } from './forecast-history';

export async function syncIfDue(
  repo: WorkspaceRepository,
  key: Buffer,
  userId?: string,
  now = Date.now(),
) {
  if (!repo.workspace()?.intelligenceSettings?.autoSync || repo.workspace()?.source !== 'live')
    return false;
  const plaid = new PlaidService(repo, key, userId),
    item = plaid.item();
  if (!item || item.environment !== 'production' || plaid.busy) return false;
  const last = Math.max(
    Date.parse(item.syncedAt || '') || 0,
    Date.parse(item.lastAutoAttemptAt || '') || 0,
  );
  if (now - last < 6 * 60 * 60000) return false;
  repo.store.transaction(() =>
    repo.store.set('plaid', { ...item, lastAutoAttemptAt: new Date(now).toISOString() }),
  );
  try {
    await plaid.sync();
  } catch {
    /* Sync stores a sanitized error; back off until the next interval. */
    return false;
  }
  return true;
}

/** Local-first polling: existing Transactions sync + free accounts/get, never billable refresh products. */
export function startBankBackground(key: Buffer, local: WorkspaceRepository, pool?: pg.Pool) {
  let running = false;
  const workspaces = pool ? new PostgresWorkspace(pool) : null;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      if (pool && workspaces) {
        const users = await pool.query(
          "SELECT user_id FROM surplus.workspaces WHERE payload->>'source'='live' AND payload->'intelligenceSettings'->>'autoSync'='true' ORDER BY user_id LIMIT 100",
        );
        for (const row of users.rows) {
          const snapshot = await workspaces.run(row.user_id, async (repo) => {
            const updated = await syncIfDue(repo, key, row.user_id);
            return {
              updated,
              state: repo.state(),
              syncedAt: new PlaidService(repo, key, row.user_id).status().syncedAt,
            };
          });
          if (snapshot.updated) {
            try {
              const report = await forecast(snapshot.state, {}, snapshot.syncedAt);
              await workspaces.run(row.user_id, (repo) =>
                recordForecast(repo, snapshot.state, {}, report),
              );
            } catch {
              /* Bank sync remains saved when Python is temporarily unavailable. */
            }
          }
        }
      } else if (await syncIfDue(local, key)) {
        const state = local.state();
        try {
          recordForecast(
            local,
            state,
            {},
            await forecast(state, {}, new PlaidService(local, key).status().syncedAt),
          );
        } catch {
          /* Retry on a later sync. */
        }
      }
    } catch {
      /* No credentials or bank response logging. Retry on the next tick. */
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), 60000);
  timer.unref();
  return () => clearInterval(timer);
}
