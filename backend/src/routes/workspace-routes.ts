import { Router } from 'express';
import { workspaceSchema } from '../../../shared/schema';
import type { WorkspaceRepository } from '../repositories/workspace-repository';
import type { PlaidService } from '../services/plaid-service';
import { forecast } from '../services/intelligence-service';
import { recordForecast } from '../services/forecast-history';
import { z } from 'zod';
export function workspaceRoutes(repository: WorkspaceRepository, plaid: PlaidService) {
  const router = Router();
  router.post('/intelligence/forecast', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const state = repository.state();
    const report = await forecast(state, req.body, plaid.status().syncedAt);
    res.json(recordForecast(repository, state, req.body, report));
  });
  router.patch('/intelligence/habits/:id', (req, res) => {
    const input = z.object({ treatment: z.enum(['automatic', 'routine', 'optional']) }).strict().parse(req.body);
    if (!repository.setHabitTreatment(req.params.id, input.treatment)) return res.status(404).json({ error: 'Transaction not found.' });
    res.json(repository.state());
  });
  router.get('/state', (_req, res) => res.json(repository.state()));
  router.put('/workspace', (req, res) => {
    const workspace = workspaceSchema.parse(req.body);
    if (
      ['sandbox', 'live'].includes(workspace.source) &&
      (!plaid.item() || workspace.source !== plaid.status().source)
    )
      return res.status(400).json({ error: 'Connect the matching bank account first.' });
    repository.save(workspace);
    res.json(repository.state());
  });
  router.post('/demo', (_req, res) => {
    repository.seedDemo();
    res.json(repository.state());
  });
  router.delete('/data', async (_req, res) => {
    if (plaid.busy)
      return res.status(409).json({ error: 'Wait for the current synchronization to finish.' });
    await plaid.disconnect();
    repository.clear();
    res.json(repository.state());
  });
  router.get('/export', (_req, res) =>
    res
      .attachment('surplus-export.json')
      .json({ exportedAt: new Date().toISOString(), ...repository.state() }),
  );
  return router;
}
