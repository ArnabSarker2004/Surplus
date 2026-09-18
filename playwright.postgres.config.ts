import 'dotenv/config';
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

if (!process.env.DATABASE_URL)
  throw new Error('Set DATABASE_URL before running PostgreSQL browser tests.');
const server = base.webServer as Exclude<typeof base.webServer, unknown[] | undefined>;
export default defineConfig({
  ...base,
  testDir: './tests/postgres-browser',
  outputDir: './artifacts/postgres-browser-tests',
  use: { ...base.use, baseURL: 'http://127.0.0.1:3003' },
  webServer: {
    ...server,
    url: 'http://127.0.0.1:3003/api/health',
    env: {
      ...server.env,
      PORT: '3003',
      DATABASE_URL: process.env.DATABASE_URL,
      SURPLUS_DATA_DIR: 'data/postgres-e2e',
      AUTH_PUBLIC_ORIGIN: 'http://127.0.0.1:3003',
    },
  },
});
