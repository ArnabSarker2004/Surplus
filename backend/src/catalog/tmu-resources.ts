import { resourceSchema, type StudentResource } from '../../../shared/resources';

// Editorial snapshot of official pages. Updating a date requires reviewing the source.
export const reviewedAt = '2026-09-16';
const tmu = 'https://www.torontomu.ca';
const zonesUrl = `${tmu}/zone-learning/zones/`;
const initiativesUrl = `${tmu}/zone-learning/initiatives/`;
const jobsUrl = `${tmu}/career-coop-student-success/career-coop/job-search/on-campus/`;
const eventsUrl = `${tmu}/career-coop-student-success/career-coop/Career_Co-op_Event_Calendar/`;
const support = {
  type: 'support' as const,
  label: 'Skills & connections',
  amount: null,
  note: 'No student payment is promised by this resource.',
};
const variable = {
  type: 'variable' as const,
  label: 'Amount varies',
  amount: null,
  note: 'Check the specific posting for compensation and payment timing.',
};
const zoneContact = {
  name: 'Zone Learning team',
  email: 'zonelearning@torontomu.ca',
  purpose: 'General navigation and program questions',
};
const jobContact = {
  name: 'Career Boost team',
  email: 'careerboost@torontomu.ca',
  purpose: 'Program and eligibility questions',
};
type Entry = Pick<StudentResource, 'id' | 'title' | 'kind' | 'summary' | 'action' | 'sources'> &
  Partial<StudentResource>;
function resource(entry: Entry): StudentResource {
  return resourceSchema.parse({
    provider: 'TMU Zone Learning',
    benefit: support,
    availability: 'Check intake',
    timing: 'No current deadline published on the reviewed page. Ask the provider.',
    deadline: null,
    commitment: 'Confirm with the provider',
    eligibility: ['Review the program requirements with the provider.'],
    tags: [],
    steps: ['Open the official page.', 'Ask about the current intake and requirements.'],
    contact: zoneContact,
    checkedAt: reviewedAt,
    ...entry,
  });
}
const source = (url: string, label = 'Official program page') => ({ url, label });
const action = (url: string, label = 'Visit official page', login = false) => ({
  url,
  label,
  login,
});

export const tmuResources: StudentResource[] = [
  resource({
    id: 'venturematch',
    title: 'VentureMatch project placements',
    kind: 'Paid placements',
    summary: 'Contribute your skills to a startup project and build practical experience.',
    benefit: {
      type: 'honorarium',
      amount: 850,
      label: '$850 honorarium',
      note: 'Published payment for successful completion; confirm payment timing with the team.',
    },
    availability: 'Waitlist',
    timing:
      'The reviewed page links to a student waitlist. A new application deadline is not published.',
    commitment: '80 hours total; on campus or remote',
    eligibility: [
      'Students are selected through application, interviews and matching. Confirm current cohort requirements.',
    ],
    tags: ['startup', 'technology', 'design', 'marketing', 'paid', 'remote'],
    steps: [
      'Join the student waitlist.',
      'Ask which cohort is next and what skills are needed.',
      'Prepare examples of your work for matching and interviews.',
    ],
    contact: {
      name: 'Zone placements team',
      email: 'zoneplacements@torontomu.ca',
      purpose: 'Student placements and upcoming cohorts',
    },
    action: action('https://zonelearning.typeform.com/to/onvsoJEe', 'Join student waitlist'),
    sources: [source(`${tmu}/zone-learning/venture-match/`)],
  }),
  resource({
    id: 'experience-ventures',
    title: 'Experience Ventures',
    kind: 'Paid placements',
    summary: 'Short entrepreneurial placements, challenges and projects with innovative companies.',
    benefit: {
      ...variable,
      label: 'Honorarium varies',
      note: 'Amount depends on the placement. Payment follows onboarding, completion and the required evaluation.',
    },
    eligibility: [
      'TMU students in any discipline, full-time or part-time.',
      'Canadian citizens, permanent residents or protected persons entitled to work in Canada.',
      'No other Experience Ventures placement in the same fiscal year.',
    ],
    residency: 'Domestic',
    tags: ['hackathon', 'startup', 'projects', 'paid'],
    steps: [
      'Review placement types and eligibility.',
      'Ask about the next available placement.',
      'Apply for the particular placement when its intake opens.',
    ],
    action: action(`${tmu}/zone-learning/initiatives/experience-ventures/`, 'Explore placements'),
    sources: [source(`${tmu}/zone-learning/initiatives/experience-ventures/`)],
  }),
  resource({
    id: 'career-boost-domestic',
    title: 'Career Boost — domestic students',
    kind: 'Campus jobs',
    provider: 'TMU Career, Co-op & Student Success',
    summary: 'Find paid campus roles through the domestic undergraduate or graduate/law pathway.',
    benefit: variable,
    availability: 'Approval window',
    opensOn: '2026-08-21',
    deadline: '2027-01-29',
    timing:
      'Aug 21, 2026–Jan 29, 2027 is the approval-application window, not a deadline for every job. Individual roles have separate deadlines.',
    residency: 'Domestic',
    fullTimeOnly: true,
    eligibility: [
      'Full-time domestic students; academic and funding criteria apply. Read the complete checklist for your student group.',
    ],
    tags: ['campus', 'employment', 'part-time', 'domestic'],
    steps: [
      'Review your domestic student category.',
      'Apply for Career Boost approval.',
      'Sign in to RecruitStudents and choose Career Boost Jobs → Job Postings.',
    ],
    contact: jobContact,
    action: action('https://recruitstudents.torontomu.ca/', 'Find campus jobs', true),
    sources: [source(jobsUrl)],
  }),
  resource({
    id: 'career-boost-international',
    title: 'Career Boost — international students',
    kind: 'Campus jobs',
    provider: 'TMU Career, Co-op & Student Success',
    summary: 'Use the dedicated international student pathway for paid campus work.',
    benefit: variable,
    availability: 'Directory',
    timing: 'Each job has its own deadline. Check the current term checklist.',
    residency: 'International',
    fullTimeOnly: true,
    eligibility: [
      'Full-time international degree students; valid study permit and residence in Ontario required. Check all current criteria.',
    ],
    tags: ['campus', 'employment', 'international', 'part-time'],
    steps: [
      'Read the international eligibility checklist.',
      'No domestic approval-letter application is required.',
      'Apply only to Career Boost International postings.',
    ],
    contact: jobContact,
    action: action('https://recruitstudents.torontomu.ca/', 'Find international roles', true),
    sources: [
      source(jobsUrl),
      source(
        `${tmu}/wellbeing-central/category/financialwellbeing/careerboost/`,
        'Career Boost student guide',
      ),
    ],
  }),
  resource({
    id: 'other-campus-jobs',
    title: 'Other on-campus jobs',
    kind: 'Campus jobs',
    provider: 'TMU RecruitStudents',
    summary: 'Browse campus work outside the Career Boost categories.',
    benefit: variable,
    availability: 'Directory',
    timing: 'Deadlines and wages appear in individual postings.',
    eligibility: [
      'Review each role’s requirements. Career Boost eligibility is not required for this listing category.',
    ],
    tags: ['campus', 'employment', 'part-time'],
    steps: [
      'Sign in with your TMU account.',
      'Open Other On-Campus Job opportunities.',
      'Read each role and apply through its listed process.',
    ],
    contact: jobContact,
    action: action('https://recruitstudents.torontomu.ca/', 'Browse other campus jobs', true),
    sources: [source(jobsUrl)],
  }),
  resource({
    id: 'recreation-jobs',
    title: 'Recreation & Active Wellbeing jobs',
    kind: 'Campus jobs',
    provider: 'TMU Recreation & Active Wellbeing',
    summary: 'Explore facilities, aquatics, events, marketing and design roles on campus.',
    benefit: variable,
    timing:
      'The page mixes seasonal postings. Confirm current vacancies and deadlines before applying.',
    eligibility: [
      'Requirements differ by role; some require Career Boost approval or first-aid certification.',
    ],
    tags: ['campus', 'recreation', 'events', 'marketing', 'design'],
    contact: {
      name: 'Recreation team',
      email: 'recreation@torontomu.ca',
      purpose:
        'General hiring navigation; individual postings may name a different application contact',
    },
    steps: [
      'Choose a role on the official page.',
      'Check its eligibility, season and application contact.',
      'Send the documents requested by that specific posting.',
    ],
    action: action(`${tmu}/recreation/about/jobs/`, 'Browse recreation roles'),
    sources: [source(`${tmu}/recreation/about/jobs/`)],
  }),
  resource({
    id: 'recreation-lifeguard',
    title: 'Recreation lifeguard',
    kind: 'Campus jobs',
    provider: 'TMU Recreation & Active Wellbeing',
    summary: 'Supervise pool safety in the Recreation & Athletic Centre.',
    benefit: {
      type: 'hourly',
      amount: 20.5,
      label: 'From $20.50 / hour',
      note: 'Published starting wage; confirm the current offer. This is not a lump-sum stipend.',
    },
    commitment: 'Fall/winter: 5–15 hours/week',
    timing: 'No application deadline is shown. Confirm that the role is still hiring.',
    eligibility: [
      'National Lifeguard and Intermediate First Aid certification; background check. This posting is non-Career Boost.',
    ],
    tags: ['aquatics', 'campus', 'paid', 'certification'],
    contact: {
      name: 'Recreation team',
      email: 'recreation@torontomu.ca',
      purpose: 'Ask about current aquatics hiring and the application contact',
    },
    action: action(`${tmu}/recreation/about/jobs/`, 'View role requirements'),
    sources: [source(`${tmu}/recreation/about/jobs/`)],
  }),
  resource({
    id: 'student-life-jobs',
    title: 'Student Life & Learning Support jobs',
    kind: 'Campus jobs',
    provider: 'TMU Student Life & Learning Support',
    summary: 'Peer support, orientation, mentoring, media and student leadership roles.',
    benefit: variable,
    availability: 'Closed',
    timing:
      'The reviewed page says 2026–2027 applications are closed. Save it to check for future hiring.',
    eligibility: ['Role-specific requirements and Career Boost categories apply.'],
    tags: ['peer support', 'leadership', 'mentoring', 'campus'],
    contact: null,
    steps: [
      'Review role descriptions to prepare for a future intake.',
      'Use the application contact in the relevant job description.',
    ],
    action: action(`${tmu}/student-life-and-learning/job-postings/`, 'View future hiring resource'),
    sources: [source(`${tmu}/student-life-and-learning/job-postings/`)],
  }),
  resource({
    id: 'awardspring',
    title: 'AwardSpring scholarships & bursaries',
    kind: 'Awards & funding',
    provider: 'TMU Student Awards & Scholarships',
    summary: 'Complete one general application to discover awards relevant to your circumstances.',
    benefit: variable,
    availability: 'Directory',
    timing:
      'Each award has its own deadline. The public overview still mentions 2025–2026; check the current cycle inside AwardSpring.',
    eligibility: [
      'Undergraduate, graduate and continuing education students; eligibility is award-specific.',
    ],
    tags: ['scholarships', 'bursaries', 'financial need'],
    contact: {
      name: 'Student Awards & Scholarships team',
      email: 'awards@torontomu.ca',
      purpose: 'AwardSpring and award-application questions',
    },
    steps: [
      'Sign in with your school account.',
      'Complete the general application.',
      'Open your matches and complete each required follow-up.',
    ],
    action: action('https://torontomu.awardspring.ca/', 'Open AwardSpring', true),
    sources: [
      source(`${tmu}/current-students/scholarships-awards/`),
      source(`${tmu}/current-students/scholarships-awards/faq/`, 'Awards contact and FAQ'),
    ],
  }),
  resource({
    id: 'emergency-bursary',
    title: 'Emergency financial support',
    kind: 'Awards & funding',
    provider: 'TMU Student Financial Assistance',
    summary:
      'Find the appropriate support route for an unforeseen financial emergency affecting your studies.',
    benefit: variable,
    timing:
      'SFA intake is seasonal in fall/winter. Confirm dates in AwardSpring; international and graduate students have separate routes.',
    eligibility: [
      'SFA’s bursary has domestic, program and academic requirements. The page links to separate international and graduate support.',
      'It is not intended to cover ordinary tuition or general budget shortfalls.',
    ],
    tags: ['emergency', 'bursary', 'support'],
    contact: null,
    steps: [
      'Read the eligibility and eligible-expense rules.',
      'Follow the route for your student group.',
      'Prepare the documentation requested by that program.',
    ],
    action: action(
      `${tmu}/current-students/scholarships-awards/bursaries/emergency-bursary/`,
      'Find the right support',
    ),
    sources: [source(`${tmu}/current-students/scholarships-awards/bursaries/emergency-bursary/`)],
  }),
  resource({
    id: 'stem-career-fair-2026',
    title: 'STEM Career Fair 2026',
    kind: 'Events',
    provider: 'TMU Career, Co-op & Student Success',
    summary: 'Meet employers recruiting for internships, co-ops and graduate careers.',
    availability: 'Scheduled',
    timing:
      'September 24, 2026 · 11 a.m.–3 p.m. Toronto time. Confirm student registration in the event calendar.',
    event: {
      start: '2026-09-24T15:00:00Z',
      end: '2026-09-24T19:00:00Z',
      location: 'Kerr Hall West Upper Gym, 379 Victoria Street, Toronto',
    },
    commitment: '4-hour event',
    eligibility: [
      'Students and recent alumni exploring STEM careers. Check student registration details.',
    ],
    tags: ['technology', 'science', 'engineering', 'networking', 'career fair'],
    contact: {
      name: 'Claudine Hawthorne-Lindo',
      email: 'chawthornelindo@torontomu.ca',
      purpose: 'Listed event contact; use the student calendar for attendance registration',
    },
    steps: [
      'Open the student event calendar for registration.',
      'Prepare a short introduction and your resume.',
      'Choose employers to meet and plan follow-ups.',
    ],
    action: action(eventsUrl, 'Find student registration'),
    sources: [
      source(
        `${tmu}/career-coop-student-success/employers/career-fairs/`,
        'Published event date and contact',
      ),
      source(eventsUrl, 'Student registration calendar'),
    ],
  }),
  resource({
    id: 'career-events',
    title: 'Career workshops & employer events',
    kind: 'Events',
    provider: 'TMU Career, Co-op & Student Success',
    summary: 'Find career preparation sessions and chances to meet employers.',
    availability: 'Directory',
    timing: 'Use the calendar for current dates and registration.',
    tags: ['resume', 'interview', 'networking', 'career'],
    contact: null,
    action: action(eventsUrl, 'Open career calendar'),
    sources: [source(eventsUrl)],
  }),
  resource({
    id: 'zone-events',
    title: 'Zone Learning events & updates',
    kind: 'Events',
    summary: 'Discover activities across the Zone Learning community.',
    availability: 'Directory',
    timing: 'Check individual announcements for dates and registration.',
    tags: ['startup', 'networking', 'innovation'],
    steps: [
      'Browse official announcements.',
      'Register through the event’s own page.',
      'Subscribe to the Zone Learning newsletter for future updates.',
    ],
    action: action(`${tmu}/zone-learning/news-events/`, 'Browse Zone news & events'),
    sources: [
      source(`${tmu}/zone-learning/news-events/`),
      source('https://zonestmu.activehosted.com/f/1', 'Subscribe to the Zone newsletter'),
    ],
  }),
  resource({
    id: 'career-mentoring',
    title: 'Career mentoring',
    kind: 'Career support',
    provider: 'TMU Tri-Mentoring Program',
    summary: 'Connect with industry professionals for career conversations and guidance.',
    eligibility: [
      'Review the mentoring stream that matches your study level or program. Matching depends on mentor availability.',
    ],
    tags: ['mentoring', 'networking', 'career'],
    contact: {
      name: 'Tri-Mentoring team',
      email: 'tri_mentoring@torontomu.ca',
      purpose: 'Career mentoring pathways and applications',
    },
    steps: [
      'Review available mentoring streams.',
      'Choose one-to-one or flash mentoring where offered.',
      'Ask about the current intake and prepare your career goals.',
    ],
    action: action(
      `${tmu}/student-life-and-learning/trimentoring/career/`,
      'Find a mentoring pathway',
    ),
    sources: [source(`${tmu}/student-life-and-learning/trimentoring/career/`)],
  }),
  resource({
    id: 'zone-advisor',
    title: 'Meet a Zone Learning startup advisor',
    kind: 'Career support',
    summary: 'Get help finding a suitable Zone and exploring a startup idea.',
    tags: ['advice', 'startup', 'entrepreneurship'],
    eligibility: ['Ask the advisor which Zone or program fits your idea and circumstances.'],
    action: action(
      'https://docs.google.com/forms/d/e/1FAIpQLSc-vtEIGiDfMTdJ_HqdZcHxWMi5OpDkD8sjXxIzwU1INcPS_w/viewform',
      'Request an advisor meeting',
    ),
    sources: [source(zonesUrl, 'Zone directory and advisor referral')],
  }),
  resource({
    id: 'startup-school',
    title: 'Startup School',
    kind: 'Learning initiatives',
    summary: 'Explore practical entrepreneurship sessions and resources.',
    tags: ['startup', 'business', 'workshops'],
    action: action(`${tmu}/zone-learning/startup-school/`, 'Explore Startup School'),
    sources: [source(`${tmu}/zone-learning/startup-school/`)],
  }),
  resource({
    id: 'zon-courses',
    title: 'ZON 100 & ZON 200',
    kind: 'Learning initiatives',
    summary:
      'Develop a project while earning academic credit; ZON 200 continues the work begun in ZON 100.',
    benefit: {
      ...support,
      label: 'Academic credit',
      note: 'Course enrolment and fees may apply. No stipend is stated.',
    },
    eligibility: ['Undergraduate course requirements and enrolment rules apply.'],
    tags: ['academic credit', 'projects', 'entrepreneurship'],
    action: action(`${tmu}/zone-learning/initiatives/zon-100/`, 'Explore ZON courses'),
    sources: [
      source(initiativesUrl),
      source(`${tmu}/zone-learning/initiatives/zon-100/`, 'Course details'),
    ],
  }),
  resource({
    id: 'dg-8116',
    title: 'DG 8116 graduate project course',
    kind: 'Learning initiatives',
    summary: 'Develop an innovative project through a graduate Zone Learning elective.',
    benefit: {
      ...support,
      label: 'Academic credit',
      note: 'Confirm course access, enrolment and any fees. No stipend is stated.',
    },
    eligibility: ['Graduate course requirements apply.'],
    tags: ['graduate', 'academic credit', 'innovation'],
    action: action(`${tmu}/zone-learning/initiatives/dg-8116/`, 'Explore the graduate course'),
    sources: [source(`${tmu}/zone-learning/initiatives/dg-8116/`)],
  }),
  resource({
    id: 'innovation-minor',
    title: 'Minor in Innovation & Zone Learning',
    kind: 'Learning initiatives',
    summary: 'Combine courses and project work to develop an entrepreneurial skill set.',
    benefit: {
      ...support,
      label: 'Academic pathway',
      note: 'Check degree and course requirements with your academic advisor.',
    },
    eligibility: ['Undergraduate students should confirm how the minor fits their degree.'],
    tags: ['academic credit', 'innovation'],
    action: action(
      `${tmu}/zone-learning/initiatives/minor-in-innovation-and-zone-learning/`,
      'Explore the minor',
    ),
    sources: [source(`${tmu}/zone-learning/initiatives/minor-in-innovation-and-zone-learning/`)],
  }),
  resource({
    id: 'lab2market',
    title: 'Lab2Market',
    kind: 'Learning initiatives',
    provider: 'Lab2Market · TMU-linked initiative',
    summary:
      'Explore programs that help researchers assess the commercial potential of their work.',
    benefit: {
      ...variable,
      label: 'Program-specific support',
      note: 'Funding varies by stream. Verify recipient, amount and permitted use; it is not necessarily personal income.',
    },
    eligibility: ['Researcher and program requirements vary by stream.'],
    tags: ['research', 'graduate', 'commercialization'],
    contact: {
      name: 'Lab2Market team',
      email: 'info@lab2market.ca',
      purpose: 'Program selection and upcoming cohorts',
    },
    action: action('https://www.lab2market.ca/', 'Explore research programs'),
    sources: [
      source('https://www.lab2market.ca/'),
      source(zonesUrl, 'TMU affiliation and contact'),
    ],
  }),
  resource({
    id: 'sdz-student-residence',
    title: 'Science Discovery Student-in-Residence',
    kind: 'Paid placements',
    provider: 'TMU Science Discovery Zone',
    summary: 'A previous startup placement program worth watching for future cohorts.',
    benefit: {
      type: 'honorarium',
      amount: 825,
      label: '$825 historical stipend',
      note: 'Amount comes from the archived cohort page; a future cohort may differ.',
    },
    availability: 'Closed',
    timing:
      'The page still references closed Fall 2024 applications. No current intake is verified.',
    commitment: 'Published model: 6–10 hours/week; 80-hour maximum',
    eligibility: [
      'Published model: full-time or part-time undergraduates in any discipline. Reconfirm for future cohorts.',
    ],
    tags: ['science', 'startup', 'paid', 'historical'],
    contact: {
      name: 'Science Discovery Zone team',
      email: 'discovery.zone@torontomu.ca',
      purpose: 'Ask whether another student cohort is planned',
    },
    action: action(`${tmu}/zone-learning/sdz/programs/student-in-residence/`, 'View past program'),
    sources: [source(`${tmu}/zone-learning/sdz/programs/student-in-residence/`)],
  }),
];

// Industry directions are navigation aids, not claims that every Zone has a paid vacancy.
const zones = [
  [
    'biomedical-zone',
    'Biomedical Zone',
    'Medical devices and healthcare innovation.',
    '/zone-learning/biomedical-zone/',
    'biomedicalzone@torontomu.ca',
    ['health', 'medical devices', 'research'],
  ],
  [
    'clean-energy-zone',
    'Clean Energy Zone',
    'Energy technology and sustainable infrastructure.',
    '/cue/clean-energy-zone/',
    'cez@torontomu.ca',
    ['energy', 'sustainability', 'engineering'],
  ],
  [
    'design-fabrication-zone',
    'Design Fabrication Zone',
    'Design, fabrication and physical prototyping.',
    '/zone-learning/design-fabrication-zone/',
    'dfz@torontomu.ca',
    ['design', 'prototyping', 'manufacturing'],
  ],
  [
    'dmz',
    'DMZ',
    'Technology ventures and startup development.',
    'https://dmz.torontomu.ca/',
    'dmz@torontomu.ca',
    ['technology', 'software', 'startup'],
  ],
  [
    'fashion-zone',
    'Fashion Zone',
    'Fashion ventures, products and technology.',
    '/zone-learning/fashion-zone/',
    'fashionzone@torontomu.ca',
    ['fashion', 'design', 'business'],
  ],
  [
    'innovation-boost-zone',
    'Innovation Boost Zone',
    'Early-stage ventures and entrepreneurial development.',
    '/innovation-boost-zone/',
    'ibz@torontomu.ca',
    ['innovation', 'technology', 'startup'],
  ],
  [
    'legal-innovation-zone',
    'Legal Innovation Zone',
    'Technology and innovation for legal services.',
    '/zone-learning/legal-innovation-zone/',
    'liz@torontomu.ca',
    ['law', 'technology', 'justice'],
  ],
  [
    'science-discovery-zone',
    'Science Discovery Zone',
    'Evidence-based experimentation and venture development.',
    '/zone-learning/sdz/',
    'discovery.zone@torontomu.ca',
    ['science', 'research', 'startup'],
  ],
  [
    'social-ventures-zone',
    'Social Ventures Zone',
    'Ventures pursuing social and community impact.',
    '/svz/',
    'socialventures@torontomu.ca',
    ['social impact', 'community', 'entrepreneurship'],
  ],
  [
    'transmedia-zone',
    'Transmedia Zone',
    'Content, storytelling and media experimentation.',
    '/zone-learning/transmediazone/',
    'transmediazone@gmail.com',
    ['media', 'storytelling', 'creative'],
  ],
] as const;
for (const [id, title, summary, path, email, tags] of zones) {
  const url = path.startsWith('https:') ? path : `${tmu}${path}`;
  tmuResources.push(
    resource({
      id,
      title,
      kind: 'Zones',
      summary,
      availability: 'Directory',
      eligibility: ['Ask the Zone about membership and student participation requirements.'],
      tags: [...tags],
      contact: {
        name: `${title} team`,
        email,
        purpose: 'Ask about student projects, programs and current ways to participate',
      },
      action: action(url, 'Explore this Zone'),
      sources: [source(url, 'Zone website'), source(zonesUrl, 'TMU Zone directory')],
    }),
  );
}
