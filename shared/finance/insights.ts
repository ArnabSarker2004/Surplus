import type { Category, Transaction, Workspace } from '../schema';
import { asOf, cad, monthsBetween, round, sum } from './money';
import { posted, totals } from './transactions';

export function spendingAnalysis(w: Workspace, transactions: Transaction[]) {
  const date = asOf(w);
  const month = date.slice(0, 7);
  const cursor = new Date(`${month}-01T12:00:00Z`);
  cursor.setUTCMonth(cursor.getUTCMonth() - 3);
  const months = monthsBetween(cursor.toISOString().slice(0, 10), date).slice(0, -1);
  const eligible = posted(transactions).filter(
    (t) => t.classification !== 'Transfer' && t.classification !== 'Income' && t.date <= date,
  );
  const history = eligible.filter((t) => months.includes(t.date.slice(0, 7)));
  const merchants = [...new Set(history.filter((t) => t.cashFlow < 0).map((t) => t.merchant))];
  const recurring = merchants
    .flatMap((merchant) => {
      const groups = months.map((m) =>
        history.filter((t) => t.merchant === merchant && t.date.startsWith(m) && t.cashFlow < 0),
      );
      // At most two purchases per month avoids calling habitual coffee a subscription.
      if (!groups.every((g) => g.length >= 1 && g.length <= 2)) return [];
      const monthly = groups.map((g) => -sum(g.map((t) => t.cashFlow)));
      const average = round(sum(monthly) / months.length);
      if (monthly.some((v) => Math.abs(v - average) > average * 0.2)) return [];
      return [
        {
          merchant,
          monthly: average,
          category: groups[0][0].category,
          observations: groups.flat().length,
        },
      ];
    })
    .sort((a, b) => b.monthly - a.monthly);
  const unusual = eligible.filter((t) => {
    if (
      !t.date.startsWith(month) ||
      t.cashFlow >= -25 ||
      ['Tuition and School', 'Textbooks and Supplies'].includes(t.category)
    )
      return false;
    const prior = history.filter((h) => h.merchant === t.merchant && h.cashFlow < 0);
    return (
      prior.length >= 3 && -t.cashFlow > (-sum(prior.map((h) => h.cashFlow)) / prior.length) * 2
    );
  });
  const weekStart = new Date(Date.parse(date) - 6 * 86400000).toISOString().slice(0, 10);
  const weeklyDiscretionary =
    -sum(
      eligible
        .filter((t) => t.date >= weekStart && t.classification === 'Discretionary')
        .map((t) => t.cashFlow),
    ) || 0;
  const monthlyAverage = round(
    sum(months.map((m) => totals(history.filter((t) => t.date.startsWith(m))).spending)) / 3,
  );
  const remaining = monthsBetween(
    date > w.semester.start ? date : w.semester.start,
    w.semester.end,
  ).length;
  return {
    recurring,
    unusual,
    weeklyDiscretionary,
    monthlyAverage,
    projectedRemainingSpending: round(monthlyAverage * remaining),
    months,
  };
}

export function insights(w: Workspace, tx: Transaction[]) {
  const date = asOf(w);
  const end = date.slice(0, 7);
  const cursor = new Date(end + '-01T12:00:00Z');
  cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  const previous = cursor.toISOString().slice(0, 7);
  cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  const before = cursor.toISOString().slice(0, 7);
  const recent = posted(tx).filter((t) => t.date.startsWith(previous));
  const older = posted(tx).filter((t) => t.date.startsWith(before));
  const spend = (a: Transaction[], cat: Category) =>
    -sum(a.filter((t) => t.category === cat).map((t) => t.cashFlow));
  const restaurants = spend(recent, 'Eating Out'),
    oldRestaurants = spend(older, 'Eating Out');
  const coffee = recent.filter((t) => t.category === 'Coffee' && t.cashFlow < 0);
  const subs = spend(recent, 'Subscriptions');
  const monthName = new Date(previous + '-01T12:00:00').toLocaleDateString('en', { month: 'long' });
  return [
    ...(restaurants > oldRestaurants && oldRestaurants > 0
      ? [
          {
            id: 'restaurants',
            title: 'A little less takeout, a little more room',
            detail: `Eating out rose ${Math.round((restaurants / oldRestaurants - 1) * 100)}% in ${monthName}, from ${cad(oldRestaurants)} to ${cad(restaurants)}.`,
            action: 'Try reducing this category by 25%.',
            impact: round(restaurants * 0.25),
            assumption: 'Assumes your last full month repeats and the reduction is maintained.',
            category: 'Eating Out' as Category,
          },
        ]
      : []),
    ...(coffee.length >= 8
      ? [
          {
            id: 'coffee',
            title: 'Keep the ritual. Change the routine.',
            detail: `${coffee.length} coffee purchases added up to ${cad(spend(recent, 'Coffee'))} in ${monthName}.`,
            action: 'Making one in three at home could free up a little extra.',
            impact: round(spend(recent, 'Coffee') / 3),
            assumption: 'Gross purchase reduction; home coffee costs are not included.',
            category: 'Coffee' as Category,
          },
        ]
      : []),
    ...(subs > 0
      ? [
          {
            id: 'subscriptions',
            title: 'Small subscriptions add up',
            detail: `${cad(subs)} went to subscriptions in ${monthName}.`,
            action: 'Review services you no longer use.',
            impact: round(subs * 0.25),
            assumption: 'Illustration assumes you can cut a quarter of subscription spending.',
            category: 'Subscriptions' as Category,
          },
        ]
      : []),
  ];
}
