import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tmuResources } from '../backend/src/catalog/tmu-resources';
import { demoWorkspace, opportunities } from '../shared/demo';
import { plan } from '../shared/finance';
import {
  needsResourceReview,
  resourceCalendar,
  resourceEmail,
  resourceFit,
  resourceSchema,
  resourceStatus,
  torontoToday,
} from '../shared/resources';

const get = (id: string) => tmuResources.find((r) => r.id === id)!;
describe('official student resources', () => {
  it('validates the catalog, unique identifiers, all ten Zones and source provenance', () => {
    assert.equal(new Set(tmuResources.map((r) => r.id)).size, tmuResources.length);
    assert.equal(tmuResources.filter((r) => r.kind === 'Zones').length, 10);
    for (const r of tmuResources) {
      assert.ok(resourceSchema.safeParse(r).success);
      assert.ok(r.sources.some((s) => new URL(s.url).hostname.endsWith('torontomu.ca')));
    }
    assert.equal(get('venturematch').availability, 'Waitlist');
    assert.equal(get('sdz-student-residence').availability, 'Closed');
    assert.equal(get('student-life-jobs').availability, 'Closed');
  });
  it('uses Toronto dates for deadline boundaries and marks events past at their actual end', () => {
    assert.equal(torontoToday(new Date('2027-01-30T02:00:00Z')), '2027-01-29');
    const r = get('career-boost-domestic');
    assert.equal(resourceStatus(r, new Date('2026-08-20T16:00:00Z')), 'Opens later');
    assert.equal(resourceStatus(r, new Date('2027-01-30T02:00:00Z')), 'Approval window');
    assert.equal(resourceStatus(r, new Date('2027-01-30T05:00:00Z')), 'Deadline passed');
    assert.equal(
      resourceStatus(get('stem-career-fair-2026'), new Date('2026-09-24T19:00:00Z')),
      'Past event',
    );
    assert.equal(needsResourceReview(r, new Date('2026-10-17T16:00:00Z')), true);
  });
  it('does not invent amounts, dates or guaranteed eligibility', () => {
    assert.equal(get('experience-ventures').benefit.amount, null);
    assert.equal(resourceCalendar(get('venturematch')), null);
    assert.equal(
      resourceSchema.safeParse({
        ...get('experience-ventures'),
        benefit: { ...get('experience-ventures').benefit, amount: 1000 },
      }).success,
      false,
    );
    const p = demoWorkspace().profile;
    assert.ok(
      resourceFit(get('career-boost-international'), p).some((s) => s.includes('international')),
    );
    assert.ok(
      resourceFit(get('career-boost-domestic'), { ...p, study: 'Part-time' }).some((s) =>
        s.includes('full-time'),
      ),
    );
  });
  it('exports timezone-safe events and all-day deadlines, with escaped and folded ICS text', () => {
    const event = get('stem-career-fair-2026');
    const result = resourceCalendar({ ...event, title: 'Career; fair,\n' + 'é'.repeat(80) })!;
    assert.match(result, /DTSTART:20260924T150000Z/);
    assert.match(result, /DTEND:20260924T190000Z/);
    assert.match(result, /SUMMARY:Career\\; fair\\,\\n/);
    for (const line of result.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
    const deadline = resourceCalendar(get('career-boost-domestic'))!;
    assert.match(deadline, /DTSTART;VALUE=DATE:20270129/);
    assert.match(deadline, /DTEND;VALUE=DATE:20270130/);
  });
  it('keeps contact drafts editable and correctly URL-encodes student input', () => {
    const link = resourceEmail(get('venturematch'), 'Alex & Sam?')!;
    assert.ok(link.startsWith('mailto:zoneplacements@torontomu.ca?'));
    const url = new URL(link);
    assert.ok(url.searchParams.get('body')!.includes('Alex & Sam?'));
    assert.equal(url.searchParams.has('bcc'), false);
    assert.equal(resourceEmail(get('student-life-jobs'), 'Alex'), null);
  });
  it('never counts tracked resources or accepted listings as confirmed semester income', () => {
    const w = demoWorkspace();
    const before = plan(w, opportunities);
    w.resourceProgress.venturematch = {
      stage: 'Accepted',
      notes: 'Waiting for written payment terms',
      followUp: '2026-09-20',
    };
    assert.deepEqual(plan(w, opportunities), before);
  });
});
