import type { Opportunity, Workspace } from '../schema';
import { cad } from './money';
import { plan } from './planning';

export function readiness(w: Workspace, opportunities: Opportunity[]) {
  const p = plan(w, opportunities);
  const emergency = w.goals.find((g) => /emergency/i.test(g.name))?.current ?? 0;
  if (p.ending < w.semester.minimumBalance)
    return {
      step: 0,
      title: 'Give your semester some breathing room',
      status: 'Stabilize semester finances',
      reason: `Your plan needs ${cad(p.targetGap)} more to cover costs and your minimum balance. Keep near-term school money accessible.`,
    };
  if (w.profile.highInterestDebt)
    return {
      step: 1,
      title: 'Make a plan for high-interest debt',
      status: 'Address high-interest debt',
      reason:
        'High-interest debt can grow faster than uncertain investment returns. Understand its cost before taking investment risk.',
    };
  if (emergency < w.semester.emergencyTarget)
    return {
      step: 2,
      title: 'Build your rainy-day fund',
      status: 'Build emergency savings',
      reason: `Your emergency goal has ${cad(emergency)} of ${cad(w.semester.emergencyTarget)}. Investments can lose value when you need cash.`,
    };
  if (!w.profile.stableIncome || w.profile.horizonYears < 5 || w.profile.riskComfort === 'Low')
    return {
      step: 3,
      title: 'A good time to learn the basics',
      status: 'Ready to learn about investing',
      reason:
        'Explore risk, fees, and diversification. A short time horizon, changing income, or low comfort with losses calls for extra care.',
    };
  return {
    step: 4,
    title: 'Explore your long-term possibilities',
    status: 'Potentially ready to explore long-term investing',
    reason:
      'Your entered plan covers the semester, emergency target, and reports no high-interest debt. This is an educational checkpoint, not a suitability assessment.',
  };
}
