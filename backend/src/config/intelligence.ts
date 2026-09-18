import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

export function intelligenceToken() {
  if (process.env.INTELLIGENCE_SERVICE_TOKEN) {
    if (process.env.INTELLIGENCE_SERVICE_TOKEN.length < 32)
      throw new Error('Intelligence service token must be at least 32 characters.');
    return process.env.INTELLIGENCE_SERVICE_TOKEN;
  }
  const directory = resolve(process.env.SURPLUS_DATA_DIR || 'data');
  mkdirSync(directory, { recursive: true });
  const file = resolve(directory, '.intelligence-key');
  if (!existsSync(file)) {
    try {
      writeFileSync(file, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }
  return readFileSync(file, 'utf8').trim();
}
