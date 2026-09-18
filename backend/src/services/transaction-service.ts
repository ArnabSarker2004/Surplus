import { classify } from '../../../shared/finance';
import type { Category, Classification } from '../../../shared/schema';
import type { WorkspaceRepository } from '../repositories/workspace-repository';

export class TransactionService {
  constructor(private repository: WorkspaceRepository) {}
  correct(
    id: string,
    input: { category: Category; classification?: Classification; saveRule: boolean },
  ) {
    const all = this.repository.transactions();
    const source = this.repository.workspace()?.source;
    const tx = all.find((t) => t.id === id && t.source === source);
    if (!tx) return false;
    const classification = input.classification ?? classify(input.category, tx.cashFlow);
    const rules = this.repository
      .rules()
      .filter(
        (r) =>
          !(
            input.saveRule &&
            r.merchant.toLowerCase() === tx.merchant.toLowerCase() &&
            r.source === tx.source
          ),
      );
    if (input.saveRule)
      rules.push({
        merchant: tx.merchant,
        category: input.category,
        classification,
        source: tx.source,
      });
    this.repository.saveCategorization(
      all.map((t) =>
        t.id === tx.id ||
        (input.saveRule &&
          t.source === tx.source &&
          !t.userCorrected &&
          t.merchant.toLowerCase() === tx.merchant.toLowerCase())
          ? {
              ...t,
              category: input.category,
              classification,
              userCorrected: t.id === tx.id || t.userCorrected,
            }
          : t,
      ),
      rules,
    );
    return true;
  }
}
