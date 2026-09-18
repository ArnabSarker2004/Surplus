import { round } from './money';

export function investment(
  initial: number,
  monthly: number,
  years: number,
  rate: number,
  fee: number,
) {
  let value = initial,
    withoutFees = initial;
  const points = [{ year: 0, value, contributions: initial }];
  const monthlyRate = Math.pow(1 + (rate - fee) / 100, 1 / 12) - 1;
  const grossRate = Math.pow(1 + rate / 100, 1 / 12) - 1;
  for (let m = 1; m <= years * 12; m++) {
    value = value * (1 + monthlyRate) + monthly;
    withoutFees = withoutFees * (1 + grossRate) + monthly;
    if (m % 12 === 0)
      points.push({ year: m / 12, value: round(value), contributions: initial + monthly * m });
  }
  const contributions = initial + monthly * years * 12;
  return {
    value: round(value),
    growth: round(value - contributions),
    contributions,
    fees: round(withoutFees - value),
    points,
  };
}
