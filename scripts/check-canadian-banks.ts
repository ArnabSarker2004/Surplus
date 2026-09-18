import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';

// A research shortlist, not a ranking by customer count. Results are catalogue
// candidates only: successful Link consent and transaction sync must be tested by the owner.
const banks = [
  ['RBC Royal Bank', 'Royal Bank of Canada'],
  ['TD Canada Trust', 'TD Canada Trust'],
  ['Scotiabank', 'Scotiabank'],
  ['BMO Bank of Montreal', 'Bank of Montreal'],
  ['CIBC', 'CIBC'],
  ['National Bank of Canada', 'National Bank'],
  ['Desjardins', 'Desjardins'],
  ['Tangerine', 'Tangerine'],
  ['Simplii Financial', 'Simplii'],
  ['EQ Bank', 'EQ Bank'],
];
const flag = process.argv.indexOf('--environment');
const environment = flag < 0 ? 'production' : process.argv[flag + 1];
if (!['sandbox', 'production'].includes(environment)) {
  console.error('Use --environment sandbox or --environment production.');
  process.exitCode = 1;
} else {
  const secretName =
    environment === 'production' ? 'PLAID_PRODUCTION_SECRET' : 'PLAID_SANDBOX_SECRET';
  const secret = process.env[secretName]?.trim();
  const clientId = process.env.PLAID_CLIENT_ID?.trim();
  if (!clientId || !secret) {
    console.error(
      `Cannot check ${environment}: set PLAID_CLIENT_ID and ${secretName} privately in .env.`,
    );
    console.error('No API calls made. Sandbox credentials do not verify live bank access.');
    process.exitCode = 1;
  } else {
    const results = [];
    for (const [bank, query] of banks) {
      try {
        const response = await fetch(`https://${environment}.plaid.com/institutions/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Plaid-Version': '2020-09-14' },
          body: JSON.stringify({
            client_id: clientId,
            secret,
            query,
            country_codes: ['CA'],
            products: ['transactions'],
          }),
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) {
          // Do not print raw responses: only known non-sensitive metadata is reported.
          results.push({
            bank,
            status: 'request-failed',
            httpStatus: response.status,
            candidates: [],
          });
          console.info(`${bank}: catalogue request failed (HTTP ${response.status})`);
          process.exitCode = 1;
          continue;
        }
        const data = (await response.json()) as {
          institutions?: {
            name: string;
            institution_id: string;
            country_codes: string[];
            products: string[];
            oauth?: boolean;
          }[];
        };
        if (!Array.isArray(data.institutions)) throw new Error('Invalid response');
        const candidates = data.institutions
          .filter((i) => i.country_codes.includes('CA') && i.products.includes('transactions'))
          .map((i) => ({ name: i.name, institutionId: i.institution_id, oauth: i.oauth ?? null }));
        results.push({
          bank,
          status: candidates.length ? 'catalogue-candidates' : 'no-match',
          candidates,
        });
        console.info(
          `${bank}: ${candidates.map((i) => `${i.name} (${i.institutionId})`).join('; ') || 'no Transactions match returned'}`,
        );
      } catch {
        results.push({ bank, status: 'request-failed', candidates: [] });
        console.info(`${bank}: catalogue request failed; check network access.`);
        process.exitCode = 1;
      }
    }
    await mkdir('artifacts', { recursive: true });
    const path = `artifacts/canadian-banks-${environment}.json`;
    await writeFile(
      path,
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          environment,
          purpose: 'Canadian Transactions catalogue lookup; not a completed connection test.',
          realAccountsConnected: 0,
          results,
        },
        null,
        2,
      ),
    );
    console.info(`Saved ${path}. No bank Items created. No personal transactions requested.`);
    if (environment === 'sandbox')
      console.info('Sandbox catalogue results do not establish production availability.');
  }
}
