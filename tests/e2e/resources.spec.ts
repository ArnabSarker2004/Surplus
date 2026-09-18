import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { readFile } from 'node:fs/promises';

test.beforeEach(async ({ page, request }) => {
  await request.delete('/api/data');
  await request.post('/api/demo', { data: {} });
  await page.clock.setFixedTime(new Date('2026-09-16T16:00:00Z'));
});

test('real resources provide sourced contacts, accessible details and persistent follow-ups', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#opportunities');
  const venture = page.getByRole('article', {
    name: 'VentureMatch project placements',
    exact: true,
  });
  await expect(venture).toBeVisible();
  await expect(venture.getByText('$850 honorarium', { exact: true })).toBeVisible();
  await expect(venture.getByText('Waitlist', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('article', { name: 'Student Life & Learning Support jobs' }),
  ).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/resources-desktop.png', fullPage: true });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await venture.getByRole('button', { name: 'Details & contact' }).click();
  const dialog = page.getByRole('dialog', { name: 'VentureMatch project placements' });
  await expect(dialog.getByRole('link', { name: /Join student waitlist/ })).toHaveAttribute(
    'href',
    'https://zonelearning.typeform.com/to/onvsoJEe',
  );
  await expect(dialog.getByRole('link', { name: 'Draft an inquiry' })).toHaveAttribute(
    'href',
    /^mailto:zoneplacements@torontomu.ca\?subject=/,
  );
  await expect(dialog.getByRole('button', { name: /Add .* to calendar/ })).toHaveCount(0);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await dialog
    .getByRole('combobox', { name: 'My progress', exact: true })
    .selectOption('Contacted');
  await dialog
    .getByRole('textbox', { name: 'My notes', exact: true })
    .fill('Ask whether the next cohort has design projects.');
  await dialog.getByLabel('Follow-up date', { exact: true }).fill('2026-09-15');
  await dialog.getByRole('button', { name: 'Save resource & notes' }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('1 follow-up due', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'My shortlist', exact: true }).click();
  await expect(venture.getByText('Contacted', { exact: true })).toBeVisible();
  await venture.getByRole('button', { name: 'Details & contact' }).click();
  await expect(dialog.getByRole('textbox', { name: 'My notes', exact: true })).toHaveValue(
    'Ask whether the next cohort has design projects.',
  );
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  const exported = await request.get('/api/export');
  expect((await exported.json()).workspace.resourceProgress.venturematch.stage).toBe('Contacted');
  await venture
    .getByRole('button', { name: 'Unsave VentureMatch project placements', exact: true })
    .click();
  await expect(venture).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('mobile filters distinguish paid work, closed programs and all ten Zones; event calendar downloads', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#opportunities');
  await page.getByRole('button', { name: /Find campus work/ }).click();
  await expect(page.getByRole('combobox', { name: 'Resource type', exact: true })).toHaveValue(
    'Campus jobs',
  );
  await page.getByRole('textbox', { name: 'Search TMU resources' }).fill('international');
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('article').getByRole('button', { name: 'Details & contact' }).click();
  await expect(
    page.getByText('The published pathway is for international students.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('textbox', { name: 'Search TMU resources' }).fill('Student Life');
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Include closed & past listings' }).check();
  await expect(page.getByRole('article').getByText('Closed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'TMU zones', exact: true }).click();
  await expect(page.getByText('10 resources', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Show more resources/ }).click();
  await expect(page.getByRole('article')).toHaveCount(10);
  await page.getByRole('textbox', { name: 'Search TMU resources' }).fill('fashion');
  await page.getByRole('article').getByRole('button', { name: 'Details & contact' }).click();
  await expect(
    page.getByRole('link', { name: 'fashionzone@torontomu.ca', exact: true }),
  ).toHaveAttribute('href', 'mailto:fashionzone@torontomu.ca');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Discover TMU', exact: true }).click();
  await page.getByRole('button', { name: /Meet & learn/ }).click();
  await page.screenshot({ path: 'artifacts/resources-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page
    .getByRole('article', { name: 'STEM Career Fair 2026', exact: true })
    .getByRole('button', { name: 'Details & contact' })
    .click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Add event to calendar', exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('stem-career-fair-2026.ics');
  const contents = await readFile((await download.path())!, 'utf8');
  expect(contents).toContain('DTSTART:20260924T150000Z');
  await page.screenshot({ path: 'artifacts/resource-details-mobile.png', fullPage: true });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});

test('resource load errors have a working retry', async ({ page }) => {
  await page.route('**/api/resources', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Directory unavailable for this test.' }),
    }),
  );
  await page.goto('/#opportunities');
  await expect(
    page.getByText('Directory unavailable for this test.', { exact: true }),
  ).toBeVisible();
  await page.unroute('**/api/resources');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(
    page.getByRole('article', { name: 'VentureMatch project placements', exact: true }),
  ).toBeVisible();
});
