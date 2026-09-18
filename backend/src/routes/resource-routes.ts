import { Router } from 'express';
import type { ResourceRepository } from '../repositories/resource-repository';

export function resourceRoutes(repository: ResourceRepository) {
  const router = Router();
  router.get('/', (_req, res) => res.json(repository.catalog()));
  return router;
}
