Use this as the **first prompt in Codex**, from the root of your existing Surplus repository. It tells Codex to inspect and plan first, then wait for approval before editing.

You are helping me complete Surplus, an existing student-focused financial planning application.

Surplus currently has a basic frontend. Your job is to inspect the existing repository, preserve anything useful, and help transform it into a polished, locally runnable, demo-ready full-stack MVP.

The immediate objective is to produce a credible software engineering portfolio project for a Wealthsimple internship application. The application deadline is September 18, so prioritize a reliable, visually impressive end-to-end product experience over production completeness.

Do not immediately begin editing files.

Your first task is to audit the repository, recommend an implementation plan, define the final architecture, and explain which features realistically fit the MVP.

Wait for my approval before making changes.

# PRODUCT SUMMARY

Surplus is a financial tracking, semester planning, analysis, suggestion, saving, investing-education, and opportunity-discovery hub designed initially for students at Toronto Metropolitan University.

It should help students answer:

1. Can I afford this semester?
2. How much confirmed funding do I have?
3. How much of my funding comes from grants, loans, employment, savings, or family support?
4. When will tuition, OSAP, employment income, and recurring expenses affect my balance?
5. Where is my money going?
6. Which spending patterns are putting my semester plan at risk?
7. How much can I safely save?
8. Should I prioritize expenses, debt, emergency savings, or investing education?
9. Which bursaries, scholarships, stipends, campus jobs, paid projects, competitions, and research opportunities could help close my funding gap?
10. How would receiving an opportunity or changing my spending affect my projected semester balance?

Surplus must do more than display financial charts. It should convert financial data into clear, explainable, actionable guidance.

# PRODUCT MOTIVATION

The product is based on a real student problem.

As a TMU student, I discovered that Learning Zones and other campus programs could provide stipends for projects and assignments. I found these opportunities mostly by luck while urgently looking for money.

There was no clear centralized system showing:

- Which paid opportunities existed
- Who was eligible
- Which opportunities matched a student’s skills
- How much time they required
- When applications were due
- How receiving the money could affect a student’s semester finances

Surplus should connect financial planning with opportunity discovery so students can understand their financial situation and take meaningful action.

# PRIMARY USER

The initial user is a TMU student who may receive:

- Employment income
- OSAP grants
- OSAP loans
- Scholarships
- Bursaries
- Campus stipends
- Paid project income
- Family support
- Personal savings
- Student loans
- Student lines of credit

The student may pay for:

- Tuition
- Mandatory fees
- Textbooks
- Course materials
- Laptop or school equipment
- Rent or residence
- Transportation
- Groceries
- Restaurants and coffee
- Phone and internet
- Subscriptions
- Personal spending
- Credit-card payments
- Other semester-specific expenses

The student may not understand whether their current spending habits will allow them to finish the semester securely.

# CORE USER JOURNEY

The core MVP journey should be:

1. Open Surplus
2. Select “Set Up My Semester” or “Try Demo”
3. Complete a premium animated onboarding flow
4. Select a university from an institution-logo grid
5. Enter academic and lifestyle information
6. Enter semester costs
7. Enter funding such as OSAP, grants, loans, bursaries, employment and savings
8. Set savings and financial goals
9. Select opportunity interests and skills
10. Review the entered information
11. Watch a short animated “Building your semester plan” sequence
12. View the semester funding plan
13. Connect Plaid Sandbox or use Demo Mode transactions
14. Review categorized spending, budgets and savings insights
15. See a projected semester surplus or funding gap
16. Receive matched opportunities
17. Model how receiving an opportunity would affect the semester
18. Build an emergency buffer or savings goal
19. Explore investing education only when financially appropriate

The complete core journey must work locally without:

- Deployment
- Authentication
- Production Plaid access
- OpenAI API credentials
- Real university integrations
- Other paid external services

# REQUIRED WORKFLOW

Work in the following phases.

## Phase 0: Audit

Inspect the complete repository.

Report:

- Current framework and versions
- Frontend architecture
- Backend architecture
- Existing routes and APIs
- Existing pages and components
- Existing database models
- Existing styling system
- Installed frontend libraries
- Installed animation libraries
- Installed chart libraries
- Existing Plaid integration
- Existing authentication
- Existing tests
- Current TypeScript, lint, test and build status
- Working functionality that should be preserved
- Mocked functionality
- Broken functionality
- Dead code
- Placeholder data
- Unsupported metrics
- Security issues
- Missing environment variables
- Major technical risks

Do not edit files during this phase.

## Phase 1: Plan

After the audit, provide:

- Current architecture summary
- Gap analysis
- Recommended architecture
- File-level implementation plan
- Proposed data models
- Proposed API routes
- Proposed frontend-library stack
- Proposed animation approach
- Recommended implementation order
- Features that fit before the deadline
- Features that should be postponed
- Risks and fallback plans

Wait for my approval before implementation.

## Phase 2: Representative visual checkpoint

After I approve the plan:

1. Build the onboarding shell.
2. Build the welcome screen.
3. Build the institution-selection screen.
4. Add progress and forward/back navigation.
5. Add the primary animations.
6. Add responsive behaviour.
7. Add reduced-motion behaviour.
8. Run the application and checks.
9. Show or describe the result.
10. Wait for my design feedback before completing the remaining screens.

## Phase 3: Core MVP

After onboarding design approval, implement the remaining product in vertical slices.

Prioritize functioning end-to-end workflows over disconnected pages.

# LOCKED VISUAL DIRECTION

The visual direction is selected.

Surplus should be inspired by Wealthsimple’s general design principles:

- Financial information made approachable
- Generous whitespace
- Strong typography
- Simple navigation
- Warm, human presentation
- Restrained colour
- Clear financial hierarchy
- Friendly language
- Premium presentation
- Progressive disclosure
- Sophisticated without being intimidating

Do not build a pixel-for-pixel Wealthsimple clone.

Do not copy:

- Wealthsimple’s logo
- Proprietary illustrations
- Exact layouts
- Exact colour values
- Marketing copy
- Product names
- Navigation structure
- Icon arrangements
- Identical cards
- Other distinctive branded assets

Create an original Surplus design system for university students.

# SURPLUS BRAND

Surplus should feel:

- Premium
- Calm
- Optimistic
- Modern
- Student-friendly
- Financially trustworthy
- Helpful
- Intelligent
- Non-judgmental
- Personal

It should not resemble:

- A generic university portal
- An enterprise admin dashboard
- A traditional corporate bank
- A crypto-trading app
- A childish financial game
- A template marketplace
- Several component libraries stitched together

# VISUAL SYSTEM

Use a warm light theme as the primary experience.

Suggested direction:

- Warm off-white page background
- Near-black primary text
- Soft beige or stone secondary surfaces
- Deep forest-green primary action colour
- Brighter green used sparingly for positive states
- Muted amber for warnings
- Muted red for urgent shortfalls
- Soft blue for educational information
- Minimal borders
- Subtle shadows
- Generous padding
- Medium-to-large corner radii
- Strong financial-number typography

Create original Surplus design tokens.

Do not copy another company’s exact palette.

Typography should combine:

- A highly readable sans-serif for controls and body text
- An optional expressive serif or display face for major welcome headings

Potential choices:

- Geist or Inter for interface text
- Instrument Serif or Newsreader for selected display headings

Verify licences and compatibility before installing fonts.

# FRONTEND LIBRARY STRATEGY

Use one coherent base system.

Recommended foundation:

- Tailwind CSS
- shadcn/ui
- Existing Radix UI or Base UI primitives already present
- Lucide icons
- React Hook Form
- Zod
- TanStack Table
- Recharts or shadcn Charts

Use Motion for React as the primary animation engine.

Motion should handle:

- Onboarding step transitions
- Shared-layout selection indicators
- Progress transitions
- Institution-card entrances
- Tag selection
- Number transitions
- Expand/collapse interactions
- Success states
- Page transitions
- Reduced-motion alternatives

React Bits may be used selectively for:

- An onboarding Stepper
- One landing-page visual
- A small number of premium microinteractions

Aceternity UI’s Multi-Step Loader may be evaluated for the final “Building your plan” sequence.

Any React Bits or Aceternity component must:

- Be adapted to the Surplus design system
- Be accessible
- Support keyboard interaction
- Respect reduced-motion settings
- Have an acceptable licence
- Be compatible with the project
- Avoid unnecessary dependencies
- Avoid becoming the primary design system

Do not install several competing animation engines.

Do not add libraries simply to list them on a résumé.

# MOTION RULES

Animations should feel smooth, controlled and premium.

Use:

- Soft springs
- Short fades
- Small vertical movement
- Shared-layout selection
- Staggered grid entrances
- Subtle number counting
- Gentle success feedback

Suggested timing:

- Hover and press: 120–180 ms
- Card selection: 180–250 ms
- Step transition: 300–450 ms
- Major onboarding transition: 400–600 ms
- Final analysis sequence: 1.5–3 seconds

Avoid:

- Excessive bouncing
- Constant background animation
- Long delays
- Aggressive scale effects
- Neon glows
- Heavy glassmorphism
- Animation on transaction tables
- Distracting movement around financial warnings

Respect `prefers-reduced-motion`.

The complete application must remain usable with animations disabled.

# PREMIUM ONBOARDING

Onboarding is one of the most important parts of the application.

It should feel like a polished fintech product, not a university form.

Use:

- One primary decision per screen
- Large headings
- Short supporting explanations
- Generous whitespace
- Animated transitions
- Immediate selection feedback
- Clear progress
- Saved local form state
- Back and continue controls
- Keyboard navigation
- Responsive design
- Accessible labels
- Friendly validation
- Review before submission

Use progressive disclosure.

Examples:

- If the student lives with family, do not require rent.
- If the student rents, reveal rent and utility fields.
- If they receive OSAP, reveal separate grant and loan fields.
- If employed, request pay amount and frequency.
- If international, do not assume OSAP eligibility.
- If uninterested in investing, do not force investing questions.

# ONBOARDING LAYOUT

Desktop:

- Surplus wordmark in the upper-left
- Progress indicator near the top
- Main question in a controlled-width area
- Optional contextual preview or animation
- Secondary back action
- Clear continue action
- Privacy reassurance where appropriate

Mobile:

- Compact header
- Progress bar
- Single-column layout
- Large touch targets
- Sticky bottom action area when useful

Do not show the full dashboard navigation during onboarding.

# ONBOARDING STEPS

## Step 0: Welcome

Heading direction:

“Let’s build your semester plan.”

Supporting message direction:

“Tell Surplus about your school, funding, expenses and goals. We’ll turn it into a clear financial plan and show you opportunities that could help.”

Actions:

- Set up my semester
- Try the TMU demo

Use a subtle original animation showing funding sources flowing into a semester plan.

Avoid generic floating coins or crypto imagery.

## Step 1: Institution

Heading:

“Where are you studying?”

Supporting text:

“We’ll use your institution to personalize your costs, resources and student opportunities.”

Create a responsive institution-logo grid.

Initial institutions:

- Toronto Metropolitan University
- University of Toronto
- York University
- University of Waterloo
- McMaster University
- Queen’s University
- Western University
- University of Ottawa

Include:

- University logo
- University name
- Location
- Search
- Selected state
- Check indicator
- “My institution isn’t listed”

Toronto Metropolitan University should be visually prominent because the MVP opportunity dataset is TMU-focused.

If another institution is selected, make it clear that institution-specific opportunity coverage is limited in the MVP.

Cards should:

- Enter with a staggered animation
- Provide hover feedback
- Provide keyboard focus
- Animate their selected state
- Work without motion
- Use large accessible hit targets

Use official university logos only for identification.

Do not distort or recolour university logos.

Store required demo assets locally where appropriate and include text fallbacks and alt text.

Do not make core onboarding dependent on an external logo service.

## Step 2: Academic profile

Collect:

- Institution
- Faculty
- Program
- Year
- Domestic or international
- Full-time or part-time
- Co-op status
- Semester start
- Semester end

Prefer selection cards, segmented controls and searchable comboboxes over unnecessary dropdown menus.

## Step 3: Living and work situation

Collect:

- Living arrangement
- Transportation
- Employment status
- Income amount
- Income frequency
- Available weekly opportunity hours
- Skills
- Interests

Skills and interests should use an animated tag picker.

## Step 4: Semester costs

Separate:

### School

- Tuition
- Mandatory fees
- Textbooks
- Course materials
- Laptop/equipment

### Living

- Rent/residence
- Groceries
- Phone
- Internet

### Transportation

- TTC/PRESTO
- GO Transit
- Vehicle
- Rideshare

### Personal

- Subscriptions
- Restaurants
- Coffee
- Shopping
- Entertainment
- Gym

### Financial obligations

- Credit-card payment
- Debt payment
- Emergency buffer

Separate one-time and recurring expenses.

Show a subtle live semester-cost total.

## Step 5: Funding

Collect:

- Savings
- Employment income
- OSAP grant
- OSAP loan
- Scholarship
- Bursary
- Stipend
- Family support
- Student line of credit
- Other funding

Each source needs:

- Name
- Amount
- Expected date
- Funding type
- Confirmation status

Funding types:

- Non-repayable
- Repayable
- Earned
- Personal

Statuses:

- Expected
- Applied
- Confirmed
- Received

Applied-for money must not count as confirmed funding.

Show a live funding total without prematurely judging the student.

## Step 6: Goals

Collect:

- Desired end-of-semester balance
- Emergency-buffer target
- Savings goal
- Target date
- Financial priorities
- Spending categories they are willing to reduce
- Interest in investing education
- High-interest debt status

## Step 7: Opportunity preferences

Collect interest in:

- Campus jobs
- Paid projects
- Learning Zone stipends
- Research work
- Scholarships
- Bursaries
- Competitions
- Hackathons
- Leadership honorariums
- Paid studies

Collect:

- Maximum weekly commitment
- Remote/on-campus preference
- Skills they want to use
- Skills they want to develop

## Step 8: Review

Summarize:

- Institution
- Academic information
- Semester costs
- Funding
- Goals
- Opportunity preferences

Allow editing by section.

Clearly identify assumptions and missing information.

## Step 9: Generate plan

After confirmation, show a short adapted multi-step analysis loader.

Messages may include:

- Organizing your semester costs
- Separating grants, loans and earned income
- Building your cash-flow timeline
- Estimating your semester balance
- Reviewing your spending plan
- Matching student opportunities
- Preparing your Surplus dashboard

Keep the sequence short.

Do not imply advanced AI processing when the calculations are deterministic.

Transition smoothly into the dashboard.

# DEMO MODE

Create a prominent “Try Demo” action.

Demo Mode must:

- Work without credentials
- Use the same components and calculations as connected data
- Clearly say “Demo data”
- Include six to twelve months of transactions
- Include student-profile information
- Include semester costs and funding
- Include matched opportunities
- Include savings insights
- Include an investing-readiness result

Use a realistic TMU demo persona:

- Third-year Computer Engineering student
- Full-time
- Domestic
- Commuting from home
- Receiving an OSAP grant and loan
- Working part-time
- Paying tuition, transportation, food, phone, textbooks, subscriptions and personal expenses
- Interested in software, design, leadership and paid projects
- Available five hours weekly for additional work
- Has a small projected semester shortfall

Create CAD accounts such as:

- Student Chequing
- Emergency Savings
- Student Credit Card

Transactions should include:

- OSAP grant
- OSAP loan
- Part-time employment
- Scholarship or bursary
- Sample campus stipend
- Tuition
- Textbooks
- PRESTO
- TTC
- Groceries
- Restaurants
- Coffee
- Phone bill
- Gym
- Spotify
- Netflix
- Cloud storage
- Shopping
- Entertainment
- Savings transfers
- Credit-card payments

Design the data so Surplus detects:

- Restaurant spending increasing
- Frequent coffee purchases
- Recurring subscriptions
- Upcoming tuition
- A small funding gap
- A realistic spending reduction
- An opportunity that could reduce the gap
- A progression toward emergency savings or investing education

# SEMESTER FUNDING PLAN

Display:

- Total semester costs
- Confirmed non-repayable funding
- Confirmed repayable funding
- Expected earned income
- Personal savings allocated
- Pending funding
- Potential opportunity income
- Projected surplus or shortfall
- Required monthly income or spending reduction
- Projected end balance

Conceptually:

confirmed funding =
confirmed grants
+ confirmed bursaries
+ confirmed loans
+ expected employment income
+ allocated savings
+ confirmed support
+ received funding

funding gap =
projected semester costs
- confirmed semester funding

Separate repayable and non-repayable funding.

Account for timing:

- Tuition may be due near semester start.
- OSAP may arrive in large disbursements.
- Employment may arrive biweekly.
- Living expenses occur throughout the semester.
- Opportunity payments may arrive later.

The MVP may use monthly periods, but retain expected dates in the data model.

# PLAID SANDBOX

Plaid should supplement Demo Mode but must not block the application.

Implement or complete:

- Server-side Link-token creation
- Transactions product
- CA country code
- Up to 730 days of history
- Frontend Plaid Link
- Server-side public-token exchange
- Secure token storage
- `/transactions/sync`
- Pagination
- Cursor persistence
- Added transactions
- Modified transactions
- Removed transactions
- Deduplication
- Synchronization state
- Error handling

Support:

- `user_transactions_dynamic`
- Custom TMU student Sandbox account
- Non-OAuth test institutions
- Demo fallback

Never expose Plaid credentials or access tokens to:

- Browser code
- Logs
- Git
- Screenshots
- Error messages

# TRANSACTION MODEL

Store:

- Transaction ID
- Account ID
- Date
- Authorized date
- Merchant
- Description
- Raw Plaid amount
- Normalized cash-flow amount
- Currency
- Pending status
- Plaid primary category
- Plaid detailed category
- Plaid confidence
- Surplus category
- Spending classification
- User-corrected status
- Data source

Plaid generally represents expenses as positive and income as negative.

Preserve raw values and normalize so:

- Income is positive cash flow
- Expenses are negative cash flow

# STUDENT CATEGORIES

Map Plaid categories into:

- Employment Income
- OSAP Funding
- Grants and Bursaries
- Scholarships
- Stipends and Opportunities
- Tuition and School
- Textbooks and Supplies
- Groceries
- Eating Out
- Coffee
- TTC and PRESTO
- Rideshare
- Housing
- Phone and Internet
- Subscriptions
- Fitness
- Shopping
- Entertainment
- Healthcare
- Debt Payments
- Savings Transfer
- Investing
- Other

Categorization priority:

1. User correction
2. Saved merchant rule
3. Known TMU/student rule
4. High-confidence Plaid category
5. Review required
6. Other

Allow students to correct categories and optionally apply a correction to future transactions from the merchant.

Store both Plaid and Surplus categories.

# DOUBLE-COUNTING RULES

Handle:

- Chequing-to-savings transfers
- Savings-to-chequing transfers
- Credit-card payments
- Refunds
- Investment contributions
- OSAP disbursements
- Reimbursements
- Cash withdrawals

Do not count credit-card payments as new spending when the underlying purchases are already included.

# DASHBOARD

The dashboard should immediately answer:

- Am I on track?
- What needs attention?
- What should I do next?

Prioritize:

1. Projected end-of-semester balance
2. Funding gap or surplus
3. Confirmed versus potential funding
4. Safe-to-save estimate
5. Most important recommendation
6. Opportunity match
7. Spending overview
8. Savings goals
9. Investing readiness
10. Upcoming deadlines

Include:

- Current balance
- Monthly income
- Monthly spending
- Net cash flow
- Savings rate
- Spending by category
- Cash-flow trend
- Recent transactions
- Budget status
- Goal progress
- Relevant recommendations

Use CAD formatting.

Avoid making it look like a dense enterprise admin dashboard.

# TRANSACTION EXPLORER

Support:

- Search
- Date/month filters
- Category filter
- Account filter
- Income/expense filter
- Pending state
- Merchant
- Description
- Amount
- Category editing
- Essential/flexible/discretionary classification

Do not rely only on colour.

# BUDGETS

Allow monthly category budgets.

Display:

- Limit
- Spending
- Remaining amount
- Percentage used
- Healthy
- Approaching limit
- Over budget

Use the same normalized transactions as the dashboard.

# FORECAST

Use a transparent calculation rather than unsupported machine learning.

Conceptually:

projected savings =
current savings
+ average recent monthly net cash flow × remaining months

Calculate:

- Remaining goal amount
- Time remaining
- Required monthly savings
- Average monthly net cash flow
- Projected ending balance
- Surplus or shortfall
- On-track status

Document assumptions.

Do not add PyTorch merely to make the technology stack impressive.

# SCENARIO PLANNER

Allow:

- Reduced discretionary spending
- Additional income
- One-time future expense
- Stipend received
- Bursary received
- Scholarship received
- Increased savings contribution

Update:

- Funding gap
- Ending balance
- Goal status
- Required savings
- Surplus or shortfall

Clearly label hypothetical scenarios.

# OPPORTUNITY HUB

Create a central hub for:

- Learning Zone stipends
- Scholarships
- Bursaries
- Campus employment
- Work-study
- Research assistant roles
- Paid student projects
- Leadership honorariums
- Competitions
- Hackathons
- Paid studies
- External grants

For the MVP, use a curated local dataset of clearly labelled sample opportunities.

Do not represent invented data as active TMU listings.

Each opportunity should include:

- ID
- Title
- Provider
- Type
- Description
- Compensation
- Deadline
- Eligibility
- Programs/faculties
- Year eligibility
- Domestic/international eligibility
- Skills
- Interests
- Weekly commitment
- Duration
- Application link when verified
- Source when verified
- Last verified date
- Sample indicator

# OPPORTUNITY MATCHING

Use explainable deterministic scoring based on:

- Program
- Faculty
- Year
- Skills
- Interests
- Availability
- Student status
- Deadline
- Eligibility

Return:

- Match score
- Reasons
- Missing information
- Eligibility conflicts

Example:

“Strong match because you are a third-year Computer Engineering student, listed React and TypeScript, and can commit five hours weekly.”

Never imply guaranteed acceptance.

# OPPORTUNITY WORKFLOW

Support:

- Recommended
- Saved
- Applying
- Applied
- Awarded
- Not selected
- Dismissed
- Expired

Only Awarded opportunities count as confirmed income.

Saved, Applying and Applied may count as potential funding but not confirmed funding.

Allow:

“What if I receive this opportunity?”

Show:

- Updated funding gap
- Updated ending balance
- Percentage of shortfall covered
- Remaining required income or spending reduction

# SPENDING ANALYSIS

Calculate:

- Essential spending
- Flexible spending
- Discretionary spending
- Spending by category
- Spending by merchant
- Month-over-month changes
- Recurring expenses
- Likely subscriptions
- Unusual spending
- Weekly discretionary spending
- Semester spending projection

Allow corrections.

# SAVINGS SUGGESTIONS

Generate deterministic, explainable suggestions.

Examples:

- Restaurant spending increased
- Subscription expenses accumulated
- Coffee purchases are frequent
- A category is approaching its limit
- A reduction would help close the semester gap
- Tuition is approaching, so money should remain liquid

Every suggestion should show:

- Behaviour detected
- Period
- Amount
- Suggested change
- Estimated impact
- Assumption

Use supportive, non-judgmental language.

# SAFE-TO-SAVE

Conceptually:

safe to save =
available funds
+ confirmed near-term income
- essential expenses
- upcoming required payments
- minimum desired balance
- unresolved funding gap

Never show a negative value as available to save.

If the result is zero, explain why.

Label it as an estimate.

# SAVINGS GOALS

Support:

- Emergency fund
- Tuition
- Textbooks
- Laptop
- Transportation
- Graduation
- Moving
- General savings
- Future investing

Each goal should include:

- Target
- Current amount
- Target date
- Priority
- Contribution frequency
- Progress
- Estimated completion

Show the effect of spending changes and awarded opportunities.

# EMERGENCY BUFFER

Display:

- Current emergency savings
- Selected target
- Months of essential expenses covered
- Remaining amount
- Suggested contribution

Do not automatically consider investments emergency cash.

# INVESTING READINESS

Use:

- Semester surplus or shortfall
- Tuition coverage
- Essential costs
- Emergency savings
- High-interest debt
- Income stability
- Time horizon
- Need for the money
- Comfort with potential losses

Possible statuses:

1. Stabilize semester finances
2. Build emergency savings
3. Address high-interest debt
4. Ready to learn about investing
5. Potentially ready to explore long-term investing

Explain the result.

Surplus must sometimes tell the student that investing is not appropriate yet.

This is educational, not regulated financial advice.

# INVESTING EDUCATION

Explain:

- Saving versus investing
- Risk and return
- Time horizon
- Risk tolerance
- Diversification
- Fees
- Compound growth
- Potential losses
- TFSA basics
- Account versus investment

Do not recommend:

- Individual stocks
- Individual crypto assets
- Options
- Leverage
- Borrowing to invest
- Guaranteed strategies
- Personally suitable portfolios

# INVESTMENT SCENARIO CALCULATOR

Accept:

- Initial amount
- Monthly contribution
- Time horizon
- Hypothetical return
- Fee estimate

Display:

- Contributions
- Hypothetical growth
- Future value
- Effect of fees

State clearly that returns are not guaranteed.

# TFSA EDUCATION

Allow students to enter contribution room manually.

Do not guess official contribution room.

Explain:

- TFSA is an account type
- Investments may be held inside it
- Contributions must remain within available room
- Withdrawal and recontribution rules apply
- Students should verify room with the CRA

# OPTIONAL AI

The core application must not require AI.

If an OpenAI integration already exists, it may optionally rephrase deterministic insights.

Do not send:

- Plaid credentials
- Access tokens
- Raw account numbers
- Unnecessary transaction details
- Personally identifying financial information

Always provide a deterministic fallback.

# DATA MODELS

Adapt these to the current architecture:

- StudentProfile
- Semester
- FundingSource
- PlannedExpense
- Account
- Transaction
- MerchantRule
- Budget
- SavingsGoal
- PlaidItem
- Opportunity
- OpportunityMatch
- OpportunityApplication
- FinancialScenario
- Insight

Avoid unnecessary microservices.

Share financial calculation logic between Demo Mode and Plaid Mode.

# TESTING

Add tests for:

- Transaction normalization
- Income totals
- Spending totals
- Net cash flow
- Savings rate
- Funding gap
- Forecast
- Safe-to-save
- Transfer exclusion
- Credit-card payment exclusion
- Category mapping
- Merchant rules
- Opportunity eligibility
- Match scoring
- Scenario calculations
- Investing readiness
- Plaid pagination
- Plaid deduplication
- Added/modified/removed transactions

Add at least one end-to-end flow:

Demo Mode
→ onboarding
→ Semester Plan
→ funding gap
→ spending insight
→ opportunity recommendation
→ opportunity scenario
→ savings goal
→ updated forecast

# SECURITY AND PRIVACY

- Never commit secrets.
- Keep financial tokens server-side.
- Validate all API inputs.
- Avoid logging financial information.
- Avoid exposing sensitive data in errors.
- Keep demo and connected data distinct.
- Allow students to edit and delete entered information.
- Do not treat estimates as guarantees.
- Do not send financial information unnecessarily to third parties.

# TRUTHFULNESS

Do not fabricate:

- User counts
- Transaction counts
- Forecast accuracy
- Performance metrics
- Savings improvements
- Active TMU opportunities
- Financial outcomes
- Production deployment
- AI capabilities

Flag unsupported claims found in:

- README
- UI
- Code comments
- Resume-oriented copy
- Existing documentation

# README

Document:

- Product problem
- Personal motivation
- Intended user
- Features
- Stack
- Architecture
- Local setup
- Environment variables
- Demo Mode
- Plaid Sandbox
- Financial formulas
- Categorization rules
- Opportunity matching
- Investing-readiness logic
- Tests
- Known limitations
- Future improvements

# MVP PRIORITY

Prioritize:

1. Repository audit
2. Architecture and design plan
3. Onboarding shell
4. Welcome screen
5. Institution grid
6. Demo Mode
7. Remaining onboarding
8. Semester funding plan
9. Dashboard
10. Transaction categorization
11. Spending insights
12. Opportunity matching
13. Opportunity scenarios
14. Savings goals
15. Safe-to-save
16. Investing readiness
17. Tests
18. README
19. Plaid Sandbox if core Demo Mode is stable

Postpone if necessary:

- Production Plaid
- Real authentication
- Deployment
- Trade execution
- Brokerage integrations
- Live market data
- Portfolio optimization
- Automated transfers
- Production opportunity ingestion
- Advanced ML
- Required AI features
- Multi-user scaling

# DEFINITION OF DONE

The MVP is complete when:

- It runs locally from documented commands.
- Demo Mode needs no credentials.
- Onboarding works end to end.
- Institution selection is responsive and accessible.
- TMU is prominent.
- Form state persists.
- Semester costs and funding are calculated.
- Confirmed and potential funding are separated.
- Transactions populate the dashboard.
- Student categories work.
- Categories can be corrected.
- Financial totals are consistent.
- Funding gap is visible.
- Savings suggestions are generated.
- Safe-to-save is calculated.
- Opportunities are matched transparently.
- Opportunity scenarios update the plan.
- Savings goals work.
- Investing readiness is explained.
- Educational investing scenarios work.
- Primary controls are functional.
- Loading, empty and error states exist.
- Reduced-motion support works.
- Keyboard navigation works.
- Mobile layout works.
- No secrets are exposed.
- Type checking passes.
- Tests pass.
- Production build succeeds.
- README is accurate.
- No unsupported claims remain.

# REQUIRED FIRST RESPONSE

Your first response must contain only:

1. Repository audit
2. Current architecture summary
3. Gap analysis
4. Recommended architecture
5. Proposed data models
6. Proposed API routes
7. Proposed frontend-library stack
8. Proposed animation/component usage
9. File-level implementation plan
10. Implementation priority
11. Risks and fallback plans
12. Features recommended for postponement

Do not edit any files yet.

Wait for my approval before implementing.