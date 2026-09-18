import type { Opportunity, Profile } from '../schema';

export function matchOpportunity(o: Opportunity, p: Profile, date: string) {
  const conflicts: string[] = [];
  const reasons: string[] = [];
  const missing: string[] = [];
  let score = 35;
  if (o.institution !== 'Any' && o.institution !== p.institution)
    conflicts.push('Institution is outside this listing’s eligibility.');
  if (!o.years.includes(p.year)) conflicts.push('Your study year is outside the listed range.');
  if (!o.residency.includes(p.residency))
    conflicts.push('Student residency requirement does not match.');
  if (o.deadline < date) conflicts.push('The sample deadline has passed.');
  if (o.hours > p.weeklyHours)
    conflicts.push(`Needs ${o.hours} hours/week; you have ${p.weeklyHours}.`);
  else {
    score += 15;
    reasons.push(`Fits your ${p.weeklyHours} available hours per week`);
  }
  if (o.programs.length && !o.programs.includes(p.program))
    conflicts.push('Program is outside the listed eligibility.');
  else {
    score += 15;
    reasons.push(
      o.programs.length ? `Open to ${p.program} students` : 'Open to students in any program',
    );
  }
  const skills = o.skills.filter((s) =>
    p.skills.map((v) => v.toLowerCase()).includes(s.toLowerCase()),
  );
  if (skills.length) {
    score += Math.min(20, skills.length * 10);
    reasons.push(`Uses your ${skills.join(' and ')} skills`);
  } else if (o.skills.length) missing.push(`Helpful skills: ${o.skills.join(', ')}`);
  if (o.interests.some((i) => p.interests.includes(i))) {
    score += 10;
    reasons.push('Connects with your interests');
  }
  if (p.opportunityTypes.includes(o.type)) score += 5;
  if (p.workPreference !== 'Either' && !o.location.includes(p.workPreference))
    missing.push('Check whether the work format suits you.');
  return {
    score: conflicts.length ? Math.min(40, score) : Math.min(100, score),
    reasons,
    missing,
    conflicts,
    eligible: !conflicts.length,
  };
}
