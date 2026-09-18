import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { categorySchema, workspaceSchema } from '../../../shared/schema';
import type { PostgresWorkspace } from '../repositories/postgres-workspace';
import type { WorkspaceRepository } from '../repositories/workspace-repository';
import { PlaidService } from '../services/plaid-service';
import { TransactionService } from '../services/transaction-service';
import { AuthError } from '../services/auth-service';
import { forecast } from '../services/intelligence-service';
import { recordForecast } from '../services/forecast-history';

/** Responses are sent only after the user's database transaction commits. */
export function postgresWorkspaceRoutes(workspaces: PostgresWorkspace, key: Buffer) {
  const router = Router();
  router.post('/intelligence/forecast', async (req, res) => {
    const id = res.locals.user?.id as string | undefined;
    if (!id) throw new AuthError('Sign in to access forecasts.', 401);
    // Release the database transaction/row lock before running CPU-intensive Python inference.
    const snapshot = await workspaces.run(id, (repository) => ({
      state: repository.state(),
      syncedAt: new PlaidService(repository, key, id).status().syncedAt,
    }));
    res.setHeader('Cache-Control', 'no-store');
    const report = await forecast(snapshot.state, req.body, snapshot.syncedAt);
    res.json(await workspaces.run(id, (repository) => recordForecast(repository, snapshot.state, req.body, report)));
  });
  type Operation = (
    repository: WorkspaceRepository,
    plaid: PlaidService,
    req: Request,
  ) => unknown | Promise<unknown>;
  const handle =
    (operation: Operation, attachment = false) =>
    async (req: Request, res: Response) => {
      const userId = res.locals.user?.id as string | undefined;
      if (!userId) throw new AuthError('Sign in to access your saved plan.', 401);
      const result = await workspaces.run(userId, (repository) =>
        operation(repository, new PlaidService(repository, key, userId), req),
      );
      if (attachment) res.attachment('surplus-export.json');
      res.json(result);
    };
  router.get(
    '/state',
    handle((repository) => repository.state()),
  );
  router.patch('/intelligence/habits/:id', handle((repository, _plaid, req) => {
    const input = z.object({ treatment: z.enum(['automatic', 'routine', 'optional']) }).strict().parse(req.body);
    if (!repository.setHabitTreatment(String(req.params.id), input.treatment)) throw new AuthError('Transaction not found.', 404);
    return repository.state();
  }));
  router.put(
    '/workspace',
    handle((repository, plaid, req) => {
      const workspace = workspaceSchema.parse(req.body);
      if (
        ['sandbox', 'live'].includes(workspace.source) &&
        (!plaid.item() || workspace.source !== plaid.status().source)
      )
        throw new AuthError('Connect the matching bank account first.', 400);
      repository.save(workspace);
      return repository.state();
    }),
  );
  router.post(
    '/demo',
    handle((repository) => {
      repository.seedDemo();
      return repository.state();
    }),
  );
  router.delete(
    '/data',
    handle(async (repository, plaid) => {
      await plaid.disconnect();
      repository.clear();
      return repository.state();
    }),
  );
  router.get(
    '/export',
    handle((repository) => ({ exportedAt: new Date().toISOString(), ...repository.state() }), true),
  );
  router.patch(
    '/transactions/:id',
    handle((repository, _plaid, req) => {
      const input = z
        .object({
          category: categorySchema,
          classification: z
            .enum(['Essential', 'Flexible', 'Discretionary', 'Transfer', 'Income', 'Review'])
            .optional(),
          saveRule: z.boolean().default(false),
        })
        .parse(req.body);
      if (!new TransactionService(repository).correct(String(req.params.id), input))
        throw new AuthError('Transaction not found.', 404);
      return repository.state();
    }),
  );
  router.get(
    '/plaid/status',
    handle((_repository, plaid) => plaid.status()),
  );
  router.post(
    '/plaid/link-token',
    handle(async (_repository, plaid, req) => ({
      linkToken: await plaid.linkToken(
        z.enum(['sandbox', 'production']).default('sandbox').parse(req.body.environment),
        req.body.update === true,
      ),
    })),
  );
  for (const [path, kind] of [
    ['exchange', 'exchange'],
    ['sandbox', 'dynamic'],
    ['student', 'student'],
  ] as const) {
    router.post(
      `/plaid/${path}`,
      handle(async (repository, plaid, req) => {
        const publicToken =
          kind === 'exchange'
            ? z
                .object({
                  publicToken: z
                    .string()
                    .regex(/^public-(sandbox|production)-/)
                    .max(300),
                })
                .parse(req.body).publicToken
            : undefined;
        await plaid.addConnection(kind, publicToken);
        return repository.state();
      }),
    );
  }
  router.post('/plaid/import', () => {
    throw new AuthError(
      'Create your own Sandbox connection, or import local data with the account migration command.',
      403,
    );
  });
  router.post('/plaid/sync', async (_req, res) => {
    const id = res.locals.user?.id as string | undefined;
    if (!id) throw new AuthError('Sign in first.', 401);
    const result = await workspaces.run(id, async (repository) => {
      try {
        await new PlaidService(repository, key, id).sync();
        return { state: repository.state() };
      } catch (error) {
        return { error };
      } // Persist the sanitized sync status before reporting the failure.
    });
    if ('error' in result) throw result.error;
    res.json(result.state);
  });
  router.delete(
    '/plaid/item',
    handle(async (repository, plaid) => {
      await plaid.disconnect();
      return repository.state();
    }),
  );
  return router;
}
