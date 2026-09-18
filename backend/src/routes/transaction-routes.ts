import { Router } from 'express';
import { z } from 'zod';
import { categorySchema } from '../../../shared/schema';
import type { WorkspaceRepository } from '../repositories/workspace-repository';
import type { TransactionService } from '../services/transaction-service';
export function transactionRoutes(service: TransactionService, repository: WorkspaceRepository) {
  const router = Router();
  router.patch('/:id', (req, res) => {
    const input = z
      .object({
        category: categorySchema,
        classification: z
          .enum(['Essential', 'Flexible', 'Discretionary', 'Transfer', 'Income', 'Review'])
          .optional(),
        saveRule: z.boolean().default(false),
      })
      .parse(req.body);
    if (!service.correct(req.params.id, input))
      return res.status(404).json({ error: 'Transaction not found.' });
    res.json(repository.state());
  });
  return router;
}
