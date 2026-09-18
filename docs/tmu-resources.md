# TMU resource directory

The Opportunity Hub defaults to a researched directory of 31 resources, including TMU's 10 on-campus Zones, placements, campus job routes, funding portals, mentoring, learning initiatives and events. Fictional financial-planning listings remain available under **Demo examples**. The dashboard now points students toward the real resource hub.

## Research and editorial rules

Sources were reviewed on **September 16, 2026**. Every catalog record links to the official page supporting it. Start with the user-provided [Zone directory](https://www.torontomu.ca/zone-learning/zones/) and [initiatives directory](https://www.torontomu.ca/zone-learning/initiatives/). Additional research covers [campus jobs](https://www.torontomu.ca/career-coop-student-success/career-coop/job-search/on-campus/), [recreation hiring](https://www.torontomu.ca/recreation/about/jobs/), [scholarships](https://www.torontomu.ca/current-students/scholarships-awards/), [career mentoring](https://www.torontomu.ca/student-life-and-learning/trimentoring/career/) and the [student event calendar](https://www.torontomu.ca/career-coop-student-success/career-coop/Career_Co-op_Event_Calendar/).

- This is an editorial snapshot, **not an automated monitoring service**. Loading the page does not reverify websites. Display source-review dates and flag reviews older than 30 days. A future monitoring service should stage proposed changes for review, retain evidence and distinguish unavailable sources from closed programs.
- Store unknown compensation and dates as `null`. Fixed honoraria, hourly rates, variable funding and nonfinancial support are different benefit types. Do not turn an hourly rate, funding cap or research budget into personal semester income.
- VentureMatch currently links to a student waitlist. Do not reuse the previously indexed September 4 deadline. Its $850 payment is conditional on successful completion.
- Science Discovery Student-in-Residence references a closed Fall 2024 cohort. Preserve its historical status and historical $825 label. Student Life & Learning Support explicitly says 2026–2027 applications are closed.
- Career Boost's January 29, 2027 date is an **approval-application deadline**, not a deadline for all jobs. Domestic and international pathways have different requirements. Link to official sign-in; never collect university credentials.
- The STEM fair is published for September 24, 2026, 11 a.m.–3 p.m. Toronto time. Link students to the student calendar, not employer registration or sponsor packages. Export exact event times as UTC. Date-only deadlines export as all-day reminders without inventing a cutoff time.
- The AwardSpring overview still mentions 2025–2026. Direct students to the portal to verify the relevant cycle and individual award deadlines.
- Published contacts are inquiry routes. Drafting an email opens the user's mail application; Surplus sends nothing. When a page does not publish a contact, direct the student to the appropriate posting or form.
- Source dates use the actual Toronto calendar, including in Demo Mode. The financial demo's frozen date does not determine whether real opportunities are current.

## Architecture

`backend/src/catalog/tmu-resources.ts` contains validated editorial records. `ResourceRepository` exposes them through `GET /api/resources`. The HTTP adapter has no financial calculation or scraping logic. `shared/resources.ts` defines contracts, progress validation, freshness and eligibility cues, email draft formatting and standards-compliant calendar serialization. The frontend feature is divided into hub, card, detail and stylesheet files under `frontend/src/features/resources/`.

Saved resource stages, notes and follow-up dates use `workspace.resourceProgress`, persisted in SQLite and included in export/deletion. Existing workspaces are upgraded with an empty progress map on read. Follow-ups are visible in the hub; this version does not send scheduled notifications. Tracking a resource, even as accepted, does not alter confirmed funding. Students can enter confirmed payment amounts and dates through the semester funding editor.

## Validation

Domain tests cover source provenance, unique IDs, dates and timezone boundaries, unknown compensation, eligibility cues, calendar escaping/folding, email encoding and isolation from financial calculations. API tests cover persistence, older workspaces, invalid dates, export and deletion. Browser tests cover search and filters, contacts, saved notes, all 10 Zones, stale/closed listing presentation, email draft links, calendar downloads, error recovery, mobile overflow and automated accessibility checks. Tests use isolated local data and do not submit applications, send emails or touch the user's bank connection.
