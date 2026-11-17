import { test, expect } from '../e2e/fixtures';
import AxeBuilder from '@axe-core/playwright';

test('student dashboard stays compact and work dates persist into real forecasts', async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  await request.post('/api/demo', { data: {} });
  await page.goto('/#intelligence');
  const nav = page.getByRole('navigation', { name: 'Money outlook sections' });
  await expect(page.getByRole('heading', { name: 'Money in. Student life out.' })).toBeVisible();
  await expect(page.locator('#outlook-content details')).toHaveCount(0);
  await expect(page.locator('.student-metric')).toHaveCount(4);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    ).toEqual([]);
    if (width === 1440)
      expect(
        await page
          .locator('.student-dashboard-grid')
          .evaluate((el) => el.getBoundingClientRect().bottom),
      ).toBeLessThan(1000);
    await page.screenshot({ path: `artifacts/student-outlook-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await nav.getByRole('button', { name: 'Work & study', exact: true }).click();
  await page.getByRole('button', { name: 'Add work term', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add work term', exact: true });
  await dialog.getByLabel('Job or employer').fill('Winter co-op');
  await dialog.getByLabel('Work starts').fill('2027-01-04');
  await dialog.getByLabel('Work ends').fill('2027-04-30');
  await dialog.getByRole('spinbutton', { name: /Take-home pay/ }).fill('1600');
  await dialog.getByLabel('First payday').fill('2027-01-15');
  await dialog.getByLabel('Last payday').fill('2027-05-07');
  await expect(dialog.getByRole('button', { name: 'Co-op', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    ).toEqual([]);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'artifacts/student-work-term.png', fullPage: true });
  await dialog.getByRole('button', { name: 'Save work term', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.intelligence-results')).not.toHaveClass(/updating/);
  const state = await (await request.get('/api/state')).json();
  expect(state.workspace.workScheduleConfirmed).toBe(true);
  expect(
    state.workspace.funding.find((f: { name: string }) => f.name === 'Winter co-op'),
  ).toMatchObject({ amount: 1600, workKind: 'Co-op', date: '2027-01-15', endDate: '2027-05-07' });
  const forecast = await (
    await request.post('/api/intelligence/forecast', { data: { horizonDays: 365 } })
  ).json();
  expect(forecast.student.incomeBasis).toBe('schedule');
  expect(forecast.student.gaps).toEqual(
    expect.arrayContaining([expect.objectContaining({ start: '2026-12-19', end: '2027-01-14' })]),
  );
  expect(
    forecast.student.jobs.find((j: { name: string }) => j.name === 'Winter co-op').lastPayday,
  ).toBe('2027-05-07');
  await page.reload();
  await nav.getByRole('button', { name: 'Work & study', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Winter co-op', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Winter co-op', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit work term', exact: true });
  await edit.getByRole('button', { name: 'Remove job', exact: true }).click();
  await expect(edit).toHaveCount(0);
  expect(
    (await (await request.get('/api/state')).json()).workspace.funding.some(
      (f: { name: string }) => f.name === 'Winter co-op',
    ),
  ).toBe(false);
});
