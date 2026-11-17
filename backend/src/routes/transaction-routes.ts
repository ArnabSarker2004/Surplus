import { Router } from 'express';
import { z } from 'zod';
import { categorySchema } from '../../../shared/schema';
import { correctionExtras, validDetail } from '../../../shared/merchants';
import { reviewFields } from '../../../shared/transaction-review';
import type { WorkspaceRepository } from '../repositories/workspace-repository';
import type { TransactionService } from '../services/transaction-service';
import { enrichWorkspace, enrichmentStatus } from '../services/merchant-enrichment';
export function transactionRoutes(service: TransactionService, repository: WorkspaceRepository) {
  const router = Router();
  router.get('/enrichment', (_req, res) => res.json(enrichmentStatus(repository)));
  router.post('/enrichment', async (_req, res) => {
    await enrichWorkspace(repository);
    res.json({ state: repository.state(), ...enrichmentStatus(repository) });
  });
  router.patch('/:id', (req, res) => {
    const input = z
      .object({
        category: categorySchema,
        classification: z
          .enum(['Essential', 'Flexible', 'Discretionary', 'Transfer', 'Income', 'Review'])
          .optional(),
        saveRule: z.boolean().default(false),
        ...correctionExtras,
        ...reviewFields,
      })
      .strict()
      .refine(
        (input) => validDetail(input.category, input.detailCategory),
        'Choose a detail within the selected category.',
      )
      .parse(req.body);
    if (!service.correct(req.params.id, input))
      return res.status(404).json({ error: 'Transaction not found.' });
    res.json(repository.state());
  });
  return router;
}
