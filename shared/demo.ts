import { classify, round } from './finance';
import {
  emptyScenario,
  type Account,
  type Opportunity,
  type Transaction,
  type Workspace,
} from './schema';

export const institutions = [
  {
    id: 'tmu',
    name: 'Toronto Metropolitan University',
    short: 'TMU',
    city: 'Toronto, ON',
    color: '#164ba5',
  },
  {
    id: 'uoft',
    name: 'University of Toronto',
    short: 'U of T',
    city: 'Toronto, ON',
    color: '#23395b',
  },
  { id: 'york', name: 'York University', short: 'York', city: 'Toronto, ON', color: '#a62b35' },
  {
    id: 'waterloo',
    name: 'University of Waterloo',
    short: 'UW',
    city: 'Waterloo, ON',
    color: '#aa7927',
  },
  {
    id: 'mcmaster',
    name: 'McMaster University',
    short: 'Mac',
    city: 'Hamilton, ON',
    color: '#76324a',
  },
  { id: 'queens', name: 'Queen’s University', short: 'QU', city: 'Kingston, ON', color: '#9c542e' },
  { id: 'western', name: 'Western University', short: 'WU', city: 'London, ON', color: '#71517f' },
  { id: 'ottawa', name: 'University of Ottawa', short: 'uO', city: 'Ottawa, ON', color: '#7d3343' },
];
export const skills = [
  'React',
  'TypeScript',
  'Python',
  'Design',
  'Writing',
  'Research',
  'Leadership',
  'Communication',
  'Data analysis',
  'Photography',
];
export const interests = [
  'Software',
  'Design',
  'Community',
  'Entrepreneurship',
  'Sustainability',
  'Research',
  'Leadership',
  'Arts',
];
export const opportunityTypes = [
  'Paid projects',
  'Learning Zone stipends',
  'Campus jobs',
  'Research work',
  'Scholarships',
  'Bursaries',
  'Competitions',
  'Hackathons',
  'Leadership honorariums',
  'Paid studies',
];
export const demoAccounts: Account[] = [
  {
    id: 'demo-chequing',
    name: 'Student Chequing',
    type: 'depository',
    subtype: 'checking',
    balance: 5625.4,
    currency: 'CAD',
    source: 'demo',
  },
  {
    id: 'demo-savings',
    name: 'Emergency Savings',
    type: 'depository',
    subtype: 'savings',
    balance: 450,
    currency: 'CAD',
    source: 'demo',
  },
  {
    id: 'demo-credit',
    name: 'Student Credit Card',
    type: 'credit',
    subtype: 'credit card',
    balance: 285.6,
    currency: 'CAD',
    source: 'demo',
  },
];
export function demoWorkspace(): Workspace {
  return {
    profile: {
      name: 'Alex',
      institution: 'Toronto Metropolitan University',
      faculty: 'Engineering',
      program: 'Computer Engineering',
      year: 3,
      residency: 'Domestic',
      study: 'Full-time',
      coop: false,
      living: 'With family',
      transportation: 'Public transit',
      employed: true,
      payAmount: 440,
      payFrequency: 'Biweekly',
      weeklyHours: 5,
      skills: ['React', 'TypeScript', 'Design'],
      interests: ['Software', 'Design', 'Leadership'],
      opportunityTypes: ['Paid projects', 'Learning Zone stipends', 'Scholarships', 'Bursaries'],
      workPreference: 'Either',
      developSkills: ['Leadership'],
      wantsInvesting: true,
      highInterestDebt: false,
      stableIncome: true,
      horizonYears: 5,
      riskComfort: 'Medium',
      priorities: ['Finish the semester comfortably', 'Build an emergency fund'],
      reduceCategories: ['Eating Out', 'Coffee', 'Subscriptions'],
      tfsaRoom: null,
    },
    semester: {
      name: 'Fall 2026',
      start: '2026-09-01',
      end: '2026-12-31',
      minimumBalance: 250,
      emergencyTarget: 1500,
    },
    funding: [
      {
        id: 'savings',
        name: 'Savings allocated to this semester',
        amount: 850,
        date: '2026-09-01',
        type: 'Personal',
        status: 'Received',
        frequency: 'Once',
      },
      {
        id: 'osap-grant',
        name: 'OSAP grant',
        amount: 2800,
        date: '2026-09-08',
        type: 'Non-repayable',
        status: 'Received',
        frequency: 'Once',
      },
      {
        id: 'osap-loan',
        name: 'OSAP loan',
        amount: 1800,
        date: '2026-09-08',
        type: 'Repayable',
        status: 'Received',
        frequency: 'Once',
      },
      {
        id: 'job',
        name: 'Part-time campus job',
        amount: 440,
        date: '2026-09-11',
        type: 'Earned',
        status: 'Expected',
        frequency: 'Biweekly',
      },
      {
        id: 'bursary',
        name: 'Student assistance bursary',
        amount: 1000,
        date: '2026-10-20',
        type: 'Non-repayable',
        status: 'Applied',
        frequency: 'Once',
      },
    ],
    expenses: [
      {
        id: 'tuition',
        name: 'Fall tuition',
        amount: 5250,
        date: '2026-09-25',
        frequency: 'Once',
        category: 'Tuition and School',
        essential: true,
      },
      {
        id: 'fees',
        name: 'Student fees',
        amount: 420,
        date: '2026-09-25',
        frequency: 'Once',
        category: 'Tuition and School',
        essential: true,
      },
      {
        id: 'books',
        name: 'Textbooks & course materials',
        amount: 350,
        date: '2026-09-10',
        frequency: 'Once',
        category: 'Textbooks and Supplies',
        essential: true,
      },
      {
        id: 'transit',
        name: 'TTC / PRESTO',
        amount: 128,
        date: '2026-09-01',
        frequency: 'Monthly',
        category: 'TTC and PRESTO',
        essential: true,
      },
      {
        id: 'groceries',
        name: 'Groceries',
        amount: 160,
        date: '2026-09-01',
        frequency: 'Monthly',
        category: 'Groceries',
        essential: true,
      },
      {
        id: 'phone',
        name: 'Phone plan',
        amount: 45,
        date: '2026-09-12',
        frequency: 'Monthly',
        category: 'Phone and Internet',
        essential: true,
      },
      {
        id: 'restaurants',
        name: 'Eating out',
        amount: 210,
        date: '2026-09-01',
        frequency: 'Monthly',
        category: 'Eating Out',
        essential: false,
      },
      {
        id: 'coffee',
        name: 'Coffee',
        amount: 65,
        date: '2026-09-01',
        frequency: 'Monthly',
        category: 'Coffee',
        essential: false,
      },
      {
        id: 'subs',
        name: 'Subscriptions',
        amount: 28,
        date: '2026-09-05',
        frequency: 'Monthly',
        category: 'Subscriptions',
        essential: false,
      },
      {
        id: 'personal',
        name: 'Shopping & entertainment',
        amount: 170.5,
        date: '2026-09-01',
        frequency: 'Monthly',
        category: 'Shopping',
        essential: false,
      },
    ],
    goals: [
      {
        id: 'emergency',
        name: 'Emergency fund',
        target: 1500,
        current: 450,
        date: '2026-12-31',
        priority: 'High',
        contribution: 75,
        frequency: 'Monthly',
      },
      {
        id: 'laptop',
        name: 'Next laptop',
        target: 1200,
        current: 180,
        date: '2027-08-01',
        priority: 'Medium',
        contribution: 50,
        frequency: 'Monthly',
      },
    ],
    budgets: [
      { id: 'b-eating', category: 'Eating Out', limit: 200 },
      { id: 'b-coffee', category: 'Coffee', limit: 60 },
      { id: 'b-groceries', category: 'Groceries', limit: 180 },
      { id: 'b-shopping', category: 'Shopping', limit: 100 },
      { id: 'b-subs', category: 'Subscriptions', limit: 35 },
    ],
    applications: {},
    resourceProgress: {},
    scenario: { ...emptyScenario },
    source: 'demo',
    onboarded: true,
  };
}
export function blankWorkspace(): Workspace {
  const w = demoWorkspace();
  w.profile = {
    ...w.profile,
    name: '',
    institution: '',
    faculty: 'Engineering',
    program: 'Computer Engineering',
    year: 1,
    employed: false,
    payAmount: 0,
    skills: [],
    interests: [],
    opportunityTypes: [],
    developSkills: [],
    stableIncome: false,
    wantsInvesting: false,
    priorities: [],
    reduceCategories: [],
  };
  w.funding = [];
  w.expenses = [];
  w.goals = [];
  w.budgets = [];
  w.source = 'manual';
  w.onboarded = false;
  return w;
}
export function demoTransactions(): Transaction[] {
  const result: Transaction[] = [];
  let index = 0;
  const add = (
    date: string,
    merchant: string,
    amount: number,
    category: Transaction['category'],
    accountId = 'demo-chequing',
    pending = false,
  ) => {
    const cashFlow = round(-amount);
    result.push({
      id: `demo-${++index}`,
      accountId,
      date,
      authorizedDate: date,
      merchant,
      description: merchant,
      rawAmount: round(amount),
      cashFlow,
      currency: 'CAD',
      pending,
      plaidPrimary: '',
      plaidDetailed: '',
      confidence: 'HIGH',
      category,
      classification: classify(category, cashFlow),
      userCorrected: false,
      source: 'demo',
    });
  };
  for (let month = 1; month <= 9; month++) {
    const prefix = `2026-${String(month).padStart(2, '0')}`;
    const days = month === 9 ? 16 : new Date(2026, month, 0).getDate();
    for (let day = 1; day <= days; day++) {
      const date = `${prefix}-${String(day).padStart(2, '0')}`;
      if (day % 2 === 1)
        add(
          date,
          day % 3 ? 'Balzac’s Coffee' : 'Tim Hortons',
          4.15 + (day % 3) * 0.55,
          'Coffee',
          'demo-credit',
        );
      if (day % 4 === 0)
        add(
          date,
          day % 8 ? 'Freshii' : 'Pai Northern Thai',
          (month === 8 ? 32 : 20) + (day % 5),
          'Eating Out',
          'demo-credit',
        );
      if (day % 7 === 2) add(date, 'No Frills', 31.8 + (day % 11), 'Groceries');
      if ([11, 25].includes(day)) add(date, 'TMU campus payroll', -440, 'Employment Income');
      if (day === 1) add(date, 'PRESTO monthly reload', 128, 'TTC and PRESTO');
      if (day === 5) {
        add(date, 'Spotify Student', 6.39, 'Subscriptions');
        add(date, 'Netflix', 16.49, 'Subscriptions');
        add(date, 'iCloud+', 3.99, 'Subscriptions');
      }
      if (day === 12) add(date, 'Public Mobile', 45, 'Phone and Internet');
      if (day === 15) {
        add(date, 'Savings transfer', 75, 'Savings Transfer');
        add(date, 'Savings transfer', -75, 'Savings Transfer', 'demo-savings');
      }
      if (day === 16) add(date, 'Uniqlo', 48.5, 'Shopping', 'demo-credit', month === 9);
      if (day === 18) add(date, 'Community gym', 25, 'Fitness');
      if (day === 20) {
        add(date, 'Credit card payment', 285.6, 'Debt Payments');
        add(date, 'Credit card payment', -285.6, 'Debt Payments', 'demo-credit');
      }
      if (day === 22) add(date, 'Cineplex', 22.5, 'Entertainment', 'demo-credit');
    }
  }
  add('2026-01-08', 'OSAP grant', -2800, 'OSAP Funding');
  add('2026-01-08', 'OSAP loan', -1800, 'OSAP Funding');
  add('2026-01-25', 'TMU winter tuition', 5250, 'Tuition and School');
  add('2026-02-10', 'Engineering scholarship', -500, 'Scholarships');
  add('2026-04-15', 'Sample Learning Zone stipend', -350, 'Stipends and Opportunities');
  add('2026-08-23', 'Uniqlo refund', -25, 'Shopping', 'demo-credit');
  add('2026-09-08', 'OSAP grant', -2800, 'OSAP Funding');
  add('2026-09-08', 'OSAP loan', -1800, 'OSAP Funding');
  add('2026-09-10', 'Campus bookstore', 350, 'Textbooks and Supplies');
  return result.sort((a, b) => b.date.localeCompare(a.date));
}
export const opportunities: Opportunity[] = [
  {
    id: 'zone',
    title: 'Build something that matters.',
    provider: 'Sample Learning Zone project',
    type: 'Learning Zone stipends',
    description:
      'Prototype a simple web tool for a student-led community project. Bring your ideas, collaborate with a small team, and leave with a portfolio piece.',
    amount: 750,
    deadline: '2026-10-02',
    paymentDate: '2026-11-15',
    institution: 'Toronto Metropolitan University',
    programs: ['Computer Engineering', 'Computer Science'],
    faculty: 'Engineering',
    years: [2, 3, 4, 5],
    residency: ['Domestic', 'International'],
    skills: ['React', 'TypeScript'],
    interests: ['Software', 'Design'],
    hours: 5,
    duration: '6 weeks',
    location: 'Remote / On campus',
    sample: true,
    sourceUrl: null,
    lastVerified: null,
  },
  {
    id: 'bursary',
    title: 'A little support goes a long way.',
    provider: 'Sample student support bursary',
    type: 'Bursaries',
    description:
      'An illustrative need-based bursary for students balancing school costs and limited income. Actual programs may require a financial-need assessment.',
    amount: 1000,
    deadline: '2026-10-15',
    paymentDate: '2026-11-20',
    institution: 'Toronto Metropolitan University',
    programs: [],
    faculty: 'Any',
    years: [1, 2, 3, 4, 5, 6, 7, 8],
    residency: ['Domestic', 'International'],
    skills: [],
    interests: ['Community'],
    hours: 1,
    duration: 'One application',
    location: 'Remote',
    sample: true,
    sourceUrl: null,
    lastVerified: null,
  },
  {
    id: 'research',
    title: 'Turn curiosity into experience.',
    provider: 'Sample engineering research assistantship',
    type: 'Research work',
    description:
      'Help a campus research team clean survey data, test a prototype, and document findings. An example of how research work could fit your semester.',
    amount: 1200,
    deadline: '2026-10-08',
    paymentDate: '2026-12-10',
    institution: 'Toronto Metropolitan University',
    programs: ['Computer Engineering', 'Computer Science'],
    faculty: 'Engineering',
    years: [3, 4, 5],
    residency: ['Domestic', 'International'],
    skills: ['Python', 'Research'],
    interests: ['Research', 'Software'],
    hours: 8,
    duration: '8 weeks',
    location: 'On campus',
    sample: true,
    sourceUrl: null,
    lastVerified: null,
  },
  {
    id: 'design',
    title: 'Make campus a little more usable.',
    provider: 'Sample student design sprint',
    type: 'Paid projects',
    description:
      'Explore accessibility issues in a student service and propose an improved experience. Work with peers on research, wireframes, and a short presentation.',
    amount: 450,
    deadline: '2026-10-22',
    paymentDate: '2026-11-30',
    institution: 'Toronto Metropolitan University',
    programs: [],
    faculty: 'Any',
    years: [1, 2, 3, 4, 5],
    residency: ['Domestic', 'International'],
    skills: ['Design', 'Communication'],
    interests: ['Design', 'Community'],
    hours: 3,
    duration: '4 weeks',
    location: 'Remote',
    sample: true,
    sourceUrl: null,
    lastVerified: null,
  },
  {
    id: 'leadership',
    title: 'Help the next class find their feet.',
    provider: 'Sample peer mentorship honorarium',
    type: 'Leadership honorariums',
    description:
      'Host small peer-support sessions and help newer students navigate campus resources. An illustrative honorarium, not an active recruitment posting.',
    amount: 300,
    deadline: '2026-09-30',
    paymentDate: '2026-12-01',
    institution: 'Toronto Metropolitan University',
    programs: [],
    faculty: 'Any',
    years: [2, 3, 4, 5],
    residency: ['Domestic', 'International'],
    skills: ['Leadership', 'Communication'],
    interests: ['Leadership', 'Community'],
    hours: 2,
    duration: '10 weeks',
    location: 'On campus',
    sample: true,
    sourceUrl: null,
    lastVerified: null,
  },
  {
    id: 'hack',
    title: 'Your next idea starts with a weekend.',
    provider: 'Sample student innovation competition',
    type: 'Hackathons',
    description:
      'Create a prototype addressing a student challenge. The amount represents an illustrative prize; participation does not guarantee compensation.',
    amount: 500,
    deadline: '2026-11-01',
    paymentDate: '2026-11-15',
    institution: 'Any',
    programs: [],
    faculty: 'Any',
    years: [1, 2, 3, 4, 5],
    residency: ['Domestic', 'International'],
    skills: ['React', 'Design'],
    interests: ['Software', 'Entrepreneurship'],
    hours: 4,
    duration: 'One weekend',
    location: 'Remote',
    sample: true,
    sourceUrl: null,
    lastVerified: null,
  },
];
