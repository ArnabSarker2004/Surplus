/** Rebuild the public, fictional forecast fixture with the real Python engine. */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { demoWorkspace, demoAccounts, demoTransactions, opportunities } from '../shared/demo';
import { defaultForecastOptions } from '../shared/intelligence';
import { forecastPayload } from '../backend/src/services/intelligence-service';
import demoCpi from '../shared/data/cpi-demo-ontario.json';
import type { EconomicContext } from '../shared/economy';

const payload = forecastPayload(
  {
    workspace: demoWorkspace(),
    accounts: demoAccounts,
    transactions: demoTransactions(),
    opportunities,
    rules: [],
  },
  defaultForecastOptions,
);
const python = resolve(
  'services/intelligence/.venv',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);
const result = spawnSync(
  python,
  [
    '-c',
    'import json,sys; sys.path.insert(0,"services/intelligence"); from app.main import forecast; from app.contracts import ForecastRequest; print(json.dumps(forecast(ForecastRequest.model_validate(json.load(sys.stdin)))))',
  ],
  {
    input: JSON.stringify(payload),
    encoding: 'utf-8',
    windowsHide: true,
    maxBuffer: 10_000_000,
    env: { ...process.env, OMP_NUM_THREADS: '1', OPENBLAS_NUM_THREADS: '1' },
  },
);
if (result.error || result.status !== 0)
  throw new Error(result.stderr || result.error?.message || 'Demo forecast generation failed');
const report = JSON.parse(result.stdout);
if (report.source !== 'demo') throw new Error('Only fictional demo output may be published');
writeFileSync(
  'frontend/src/features/intelligence/demo-forecast.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log('Generated public forecast from fictional demo data using the Python engine.');
