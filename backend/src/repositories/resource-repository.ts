import { reviewedAt, tmuResources } from '../catalog/tmu-resources';
import type { ResourceCatalog } from '../../../shared/resources';

/** Curated public catalog, independent of private banking and planning data. */
export class ResourceRepository {
  catalog(): ResourceCatalog {
    return { resources: tmuResources, reviewedAt, automaticMonitoring: false };
  }
}
