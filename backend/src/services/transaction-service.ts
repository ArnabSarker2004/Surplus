import { classify } from '../../../shared/finance';
import type { Category, Classification, Transaction } from '../../../shared/schema';
import { splitsMatch } from '../../../shared/transaction-review';
import type { WorkspaceRepository } from '../repositories/workspace-repository';
import { merchantRuleKey, merchantRuleKeys } from '../../../shared/merchants';
import { AuthError } from './auth-service';
import { depositPurposePatch } from '../../../shared/deposits';

export class TransactionService {
  constructor(private repository: WorkspaceRepository) {}
  correct(
    id: string,
    input: {
      category: Category;
      classification?: Classification;
      saveRule: boolean;
      merchantOverride?: string | null;
      detailCategory?: string | null;
      forecastTreatment?: Transaction['forecastTreatment'];
      splits?: Transaction['splits'];
      depositPurpose?: Transaction['depositPurpose'];
    },
  ) {
    const all = this.repository.transactions();
    const source = this.repository.workspace()?.source;
    const tx = all.find((t) => t.id === id && t.source === source);
    if (!tx) return false;
    if (input.depositPurpose && (tx.cashFlow <= 0 || input.saveRule))
      throw new AuthError('Review the source of an incoming deposit individually.', 400);
    if (input.depositPurpose)
      input = {
        ...input,
        ...depositPurposePatch(input.depositPurpose, { ...tx, category: input.category }),
      };
    if (input.splits && !splitsMatch({ cashFlow: tx.cashFlow, splits: input.splits }))
      throw new AuthError(
        'Split amounts must add up exactly to the transaction amount, with at least two parts.',
        400,
      );
    if (
      input.forecastTreatment === 'reimbursement' &&
      (tx.cashFlow <= 0 ||
        ['Income', 'Transfer', 'Review'].includes(
          input.classification ?? classify(input.category, tx.cashFlow),
        ))
    )
      throw new AuthError(
        'A received reimbursement must be a positive deposit assigned to its original spending category.',
        400,
      );
    if (
      input.splits?.some((p) =>
        ['Income', 'Transfer', 'Review'].includes(classify(p.category, tx.cashFlow)),
      )
    )
      throw new AuthError('Split purchases into spending categories only.', 400);
    const matchKey = merchantRuleKey(tx);
    const matchKeys = merchantRuleKeys(tx);
    if (input.saveRule && !matchKey)
      throw new AuthError(
        'This payment does not identify a unique merchant. Save a correction for this transaction only.',
        400,
      );
    const existingRule = this.repository
      .rules()
      .find(
        (r) =>
          r.source === tx.source &&
          (r.merchantKey
            ? matchKeys.includes(r.merchantKey)
            : r.merchant.toLowerCase() === tx.merchant.toLowerCase()),
      );
    const extras = {
      ...(input.merchantOverride !== undefined
        ? { merchantOverride: input.merchantOverride, merchantCorrected: true }
        : {}),
      ...(input.detailCategory !== undefined
        ? { detailCategory: input.detailCategory, detailCategoryCorrected: true }
        : {}),
    };
    const classification = input.classification ?? classify(input.category, tx.cashFlow);
    const rules = this.repository
      .rules()
      .filter(
        (r) =>
          !(
            input.saveRule &&
            (r.merchantKey
              ? matchKeys.includes(r.merchantKey)
              : r.merchant.toLowerCase() === tx.merchant.toLowerCase()) &&
            r.source === tx.source
          ),
      );
    if (input.saveRule)
      rules.push({
        merchant: tx.merchant,
        category: input.category,
        classification,
        source: tx.source,
        merchantKey: matchKey!,
        ...(existingRule?.merchantOverride !== undefined
          ? { merchantOverride: existingRule.merchantOverride }
          : {}),
        ...(existingRule?.detailCategory !== undefined
          ? {
              detailCategory:
                existingRule.category === input.category ? existingRule.detailCategory : null,
            }
          : {}),
        ...(input.merchantOverride !== undefined
          ? { merchantOverride: input.merchantOverride }
          : {}),
        ...(input.detailCategory !== undefined ? { detailCategory: input.detailCategory } : {}),
      });
    this.repository.saveCategorization(
      all.map((t) =>
        (t.id === tx.id && t.source === tx.source) ||
        (input.saveRule &&
          t.source === tx.source &&
          !t.userCorrected &&
          merchantRuleKey(t) === matchKey)
          ? {
              ...t,
              category: input.category,
              classification,
              userCorrected: t.id === tx.id || t.userCorrected,
              categoryOrigin: 'user' as const,
              depositPurpose:
                input.depositPurpose ??
                (input.category === t.category ? t.depositPurpose : undefined),
              ...extras,
              ...(t.id === tx.id
                ? {
                    ...(input.forecastTreatment !== undefined
                      ? { forecastTreatment: input.forecastTreatment }
                      : {}),
                    ...(input.splits !== undefined ? { splits: input.splits } : {}),
                    ...(input.depositPurpose !== undefined
                      ? { depositPurpose: input.depositPurpose }
                      : {}),
                  }
                : {}),
            }
          : t,
      ),
      rules,
    );
    return true;
  }
}
