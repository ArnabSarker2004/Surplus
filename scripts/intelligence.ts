import 'dotenv/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { intelligenceToken } from '../backend/src/config/intelligence';

const python = resolve(
  'services/intelligence/.venv',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);
const setup = process.argv.includes('--setup');
const test = process.argv.includes('--test');
async function run(command: string, args: string[], extraEnv: NodeJS.ProcessEnv = {}) {
  return await new Promise<number>((resolveCode, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      windowsHide: true,
      env: { ...process.env, OMP_NUM_THREADS: '1', OPENBLAS_NUM_THREADS: '1', ...extraEnv },
    });
    child.on('error', reject);
    child.on('exit', (code) => resolveCode(code || 0));
    for (const signal of ['SIGINT', 'SIGTERM'] as const)
      process.once(signal, () => child.kill(signal));
  });
}
if (setup) {
  if (!existsSync(python)) {
    const result = await run('python', ['-m', 'venv', 'services/intelligence/.venv']);
    if (result) process.exit(result);
  }
  process.exit(
    await run(python, ['-m', 'pip', 'install', '-r', 'services/intelligence/requirements.lock']),
  );
}
if (!existsSync(python))
  throw new Error('Install the Python service first: npm run intelligence:setup');
if (test) process.exit(await run(python, ['-m', 'pytest', 'services/intelligence/tests', '-q']));
const port =
  new URL(process.env.INTELLIGENCE_SERVICE_URL || 'http://127.0.0.1:8001').port || '8001';
process.exit(
  await run(
    python,
    [
      '-m',
      'uvicorn',
      'app.main:app',
      '--app-dir',
      'services/intelligence',
      '--host',
      '127.0.0.1',
      '--port',
      port,
      '--no-access-log',
    ],
    { INTELLIGENCE_SERVICE_TOKEN: intelligenceToken() },
  ),
);
