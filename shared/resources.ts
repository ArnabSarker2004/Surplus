import { z } from 'zod';
import type { Profile } from './schema';

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value,
  );
const httpsUrl = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === 'https:');
export const resourceKinds = [
  'Paid placements',
  'Campus jobs',
  'Awards & funding',
  'Events',
  'Career support',
  'Zones',
  'Learning initiatives',
] as const;
export const resourceStages = [
  'Saved',
  'Contacted',
  'Preparing',
  'Applied',
  'Accepted',
  'Completed',
  'Not pursuing',
] as const;
export const resourceProgressSchema = z.object({
  stage: z.enum(resourceStages),
  notes: z.string().max(2000),
  followUp: date.nullable(),
});
export type ResourceProgress = z.infer<typeof resourceProgressSchema>;
export const resourceSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(1),
    provider: z.string().min(1),
    kind: z.enum(resourceKinds),
    summary: z.string().min(1),
    benefit: z.object({
      type: z.enum(['honorarium', 'hourly', 'variable', 'support']),
      label: z.string().min(1),
      amount: z.number().positive().nullable(),
      note: z.string().min(1),
    }),
    availability: z.enum([
      'Check intake',
      'Waitlist',
      'Closed',
      'Directory',
      'Scheduled',
      'Approval window',
    ]),
    timing: z.string().min(1),
    deadline: date.nullable(),
    opensOn: date.nullable().default(null),
    event: z
      .object({ start: z.string().datetime(), end: z.string().datetime(), location: z.string() })
      .nullable()
      .default(null),
    commitment: z.string(),
    eligibility: z.array(z.string()).min(1),
    residency: z.enum(['Domestic', 'International']).nullable().default(null),
    fullTimeOnly: z.boolean().default(false),
    tags: z.array(z.string()),
    steps: z.array(z.string()).min(1),
    contact: z
      .object({ name: z.string(), email: z.string().email(), purpose: z.string() })
      .nullable(),
    action: z.object({ label: z.string(), url: httpsUrl, login: z.boolean().default(false) }),
    sources: z.array(z.object({ label: z.string(), url: httpsUrl })).min(1),
    checkedAt: date,
  })
  .superRefine((resource, ctx) => {
    if (
      resource.benefit.amount !== null &&
      !['honorarium', 'hourly'].includes(resource.benefit.type)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['benefit', 'amount'],
        message: 'Only a published fixed honorarium or hourly rate has an amount.',
      });
    if (resource.event && Date.parse(resource.event.end) <= Date.parse(resource.event.start))
      ctx.addIssue({ code: 'custom', path: ['event'], message: 'Event must end after it starts.' });
    if (resource.availability === 'Scheduled' && !resource.event)
      ctx.addIssue({
        code: 'custom',
        path: ['event'],
        message: 'Scheduled events need exact times.',
      });
    if (resource.availability === 'Approval window' && (!resource.opensOn || !resource.deadline))
      ctx.addIssue({
        code: 'custom',
        path: ['deadline'],
        message: 'Approval windows need start and end dates.',
      });
  });
export type StudentResource = z.infer<typeof resourceSchema>;
export interface ResourceCatalog {
  resources: StudentResource[];
  reviewedAt: string;
  automaticMonitoring: false;
}

/** Real resources always use today's Toronto date, never the frozen demo semester. */
export function torontoToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function resourceStatus(resource: StudentResource, now = new Date()) {
  const today = torontoToday(now);
  if (resource.event && Date.parse(resource.event.end) <= now.getTime()) return 'Past event';
  if (resource.deadline && resource.deadline < today) return 'Deadline passed';
  if (resource.opensOn && resource.opensOn > today) return 'Opens later';
  return resource.availability;
}
export function needsResourceReview(resource: StudentResource, now = new Date()) {
  return (Date.parse(torontoToday(now)) - Date.parse(resource.checkedAt)) / 86400000 > 30;
}
export function resourceFit(resource: StudentResource, profile: Profile) {
  const checks: string[] = [];
  if (profile.institution !== 'Toronto Metropolitan University')
    checks.push('This resource is based at TMU; ask about access from your institution.');
  if (resource.residency && resource.residency !== profile.residency)
    checks.push(`The published pathway is for ${resource.residency.toLowerCase()} students.`);
  if (resource.fullTimeOnly && profile.study !== 'Full-time')
    checks.push('This pathway requires full-time enrolment.');
  return checks;
}
export function resourceEmail(resource: StudentResource, name: string) {
  if (!resource.contact) return null;
  const subject = `Student inquiry: ${resource.title}`;
  const body = `Hello ${resource.contact.name},\n\nI'm ${name}, and I'm interested in ${resource.title}. Could you confirm the current intake, eligibility, application steps, and any deadlines? If funding is available, could you also clarify its amount and payment timing?\n\nThank you,\n${name}`;
  return `mailto:${resource.contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const escapeCalendar = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
const stamp = (date: string) => date.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
/** A known date is required. Date-only deadlines stay all-day; no invented cutoff time. */
export function resourceCalendar(resource: StudentResource, now = new Date()): string | null {
  if (!resource.event && !resource.deadline) return null;
  const dates = resource.event
    ? [
        `DTSTART:${stamp(resource.event.start)}`,
        `DTEND:${stamp(resource.event.end)}`,
        `LOCATION:${escapeCalendar(resource.event.location)}`,
      ]
    : [
        `DTSTART;VALUE=DATE:${resource.deadline!.replace(/-/g, '')}`,
        `DTEND;VALUE=DATE:${new Date(Date.parse(resource.deadline!) + 86400000).toISOString().slice(0, 10).replace(/-/g, '')}`,
      ];
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Surplus//TMU resources//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${resource.id}@surplus.local`,
    `DTSTAMP:${stamp(now.toISOString())}`,
    ...dates,
    `SUMMARY:${escapeCalendar(resource.event ? resource.title : `${resource.title}: deadline`)}`,
    `DESCRIPTION:${escapeCalendar(`${resource.timing}\nConfirm details with the provider.\n${resource.action.url}`)}`,
    `URL:${resource.action.url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  // RFC 5545 folds lines at 75 UTF-8 octets without splitting a code point.
  return (
    lines
      .map((line) => {
        let result = '',
          length = 0;
        for (const character of line) {
          const bytes = new TextEncoder().encode(character).length;
          if (length + bytes > 75) {
            result += '\r\n ';
            length = 1;
          }
          result += character;
          length += bytes;
        }
        return result;
      })
      .join('\r\n') + '\r\n'
  );
}
