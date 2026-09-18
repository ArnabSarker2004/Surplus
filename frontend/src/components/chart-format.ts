const compactCurrency = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Compact axes leave room for the plot; tooltips retain the full CAD amount. */
export const chartMoney = (value: number) => compactCurrency.format(value);
