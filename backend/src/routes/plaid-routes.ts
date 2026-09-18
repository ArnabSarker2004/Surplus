import { Router } from 'express';
import { z } from 'zod';
import type { WorkspaceRepository } from '../repositories/workspace-repository';
import type { PlaidService } from '../services/plaid-service';
export function plaidRoutes(service: PlaidService, repository: WorkspaceRepository) {
  const router = Router();
  router.get('/status', (_req, res) => res.json(service.status()));
  router.post('/link-token', async (req, res) =>
    res.json({
      linkToken: await service.linkToken(
        z.enum(['sandbox', 'production']).default('sandbox').parse(req.body.environment),
        req.body.update === true,
      ),
    }),
  );
  router.post('/exchange', async (req, res) => {
    const { publicToken } = z
      .object({
        publicToken: z
          .string()
          .regex(/^public-(sandbox|production)-/)
          .max(300),
      })
      .parse(req.body);
    await service.addConnection('exchange', publicToken);
    res.json(repository.state());
  });
  router.post('/import', async (_req, res) => {
    await service.addConnection('import');
    res.json(repository.state());
  });
  router.post('/sandbox', async (_req, res) => {
    await service.addConnection('dynamic');
    res.json(repository.state());
  });
  router.post('/student', async (_req, res) => {
    await service.addConnection('student');
    res.json(repository.state());
  });
  router.post('/sync', async (_req, res) => {
    await service.sync();
    res.json(repository.state());
  });
  router.delete('/item', async (_req, res) => {
    await service.disconnect();
    res.json(repository.state());
  });
  return router;
}
